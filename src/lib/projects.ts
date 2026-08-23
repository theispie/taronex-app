/**
 * ตรรกะของ M3 — ลูกค้า โปรเจกต์ เฟส งานหลัก
 *
 * เขียนเป็นฟังก์ชันที่รับ Tx เพื่อให้เทสต์เรียกตรงได้
 * route ทำหน้าที่แค่แปลง input/output กับตัดสินสิทธิ์
 */

import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { clientContacts, clients, features, projectPhases, projects, tasks } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { validateColumns } from '@/lib/types';

// ─────────────────────────── ลูกค้า ───────────────────────────

export async function listClients(tx: Tx) {
  const rows = await tx
    .select({
      id: clients.id,
      name: clients.name,
      code: clients.code,
      note: clients.note,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .orderBy(asc(clients.name));

  // นับโปรเจกต์และผู้ติดต่อทีเดียวทั้งที่ทำงาน แล้วค่อยแมป ไม่ยิงทีละราย
  const projCounts = await tx
    .select({ clientId: projects.clientId, n: count() })
    .from(projects)
    .where(eq(projects.isArchived, false))
    .groupBy(projects.clientId);
  const contactCounts = await tx
    .select({ clientId: clientContacts.clientId, n: count() })
    .from(clientContacts)
    .groupBy(clientContacts.clientId);
  // พอร์ทัลเปิดเมื่อมีโปรเจกต์ที่ส่งมอบแล้วอย่างน้อยหนึ่ง
  const portal = await tx
    .select({ clientId: projects.clientId, n: count() })
    .from(projects)
    .where(eq(projects.portalEnabled, true))
    .groupBy(projects.clientId);

  const p = new Map(projCounts.map((r) => [r.clientId, r.n]));
  const c = new Map(contactCounts.map((r) => [r.clientId, r.n]));
  const po = new Map(portal.map((r) => [r.clientId, r.n]));

  return rows.map((r) => ({
    ...r,
    projects: p.get(r.id) ?? 0,
    contacts: c.get(r.id) ?? 0,
    portalEnabled: (po.get(r.id) ?? 0) > 0,
  }));
}

export async function createClient(
  tx: Tx,
  tenantId: string,
  input: { name: string; code: string; note?: string },
) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name) throw new ApiError('E_INVALID', 'ต้องมีชื่อลูกค้า', 'name');
  if (code.length < 1 || code.length > 3) {
    throw new ApiError('E_INVALID', 'ตัวย่อใช้ได้ 1–3 ตัว', 'code');
  }
  const rows = await tx
    .insert(clients)
    .values({ tenantId, name, code, note: input.note?.trim() || null })
    .returning({ id: clients.id, name: clients.name, code: clients.code });
  return rows[0];
}

export async function updateClient(
  tx: Tx,
  clientId: string,
  patch: { name?: string; code?: string; note?: string },
) {
  const set: Record<string, string | null> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.code?.trim()) set.code = patch.code.trim().toUpperCase();
  if (patch.note !== undefined) set.note = patch.note.trim() || null;
  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

  const rows = await tx
    .update(clients)
    .set(set)
    .where(eq(clients.id, clientId))
    .returning({ id: clients.id });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
  return rows[0];
}

export async function listContacts(tx: Tx, clientId: string) {
  return tx
    .select({
      id: clientContacts.id,
      name: clientContacts.name,
      email: clientContacts.email,
      canReport: clientContacts.canReport,
      canSeeAll: clientContacts.canSeeAll,
    })
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId))
    .orderBy(asc(clientContacts.name));
}

/** ผู้ติดต่อของลูกค้าไม่ใช่ users และไม่นับโควตาที่นั่ง — เข้าได้ด้วยลิงก์ใช้ครั้งเดียวเท่านั้น */
export async function addContact(
  tx: Tx,
  tenantId: string,
  clientId: string,
  input: { name: string; email: string; canReport?: boolean; canSeeAll?: boolean },
) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new ApiError('E_INVALID', 'ต้องมีชื่อผู้ติดต่อ', 'name');
  if (!email.includes('@')) throw new ApiError('E_INVALID', 'อีเมลไม่ถูกต้อง', 'email');

  const dup = await tx
    .select({ id: clientContacts.id })
    .from(clientContacts)
    .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.email, email)))
    .limit(1);
  if (dup[0]) throw new ApiError('E_CONFLICT', 'อีเมลนี้เป็นผู้ติดต่ออยู่แล้ว', 'email');

  const rows = await tx
    .insert(clientContacts)
    .values({
      tenantId,
      clientId,
      name,
      email,
      canReport: input.canReport ?? true,
      canSeeAll: input.canSeeAll ?? false,
    })
    .returning({ id: clientContacts.id });
  return rows[0];
}

/**
 * เพิกถอนสิทธิ์เข้าพอร์ทัล
 * ลบแถวผู้ติดต่อ แต่เรื่องที่เขาเคยแจ้งยังอยู่ครบ — tasks.contact_id ตั้งเป็น NULL
 */
export async function removeContact(tx: Tx, contactId: string) {
  await tx.update(tasks).set({ contactId: null }).where(eq(tasks.contactId, contactId));
  const rows = await tx
    .delete(clientContacts)
    .where(eq(clientContacts.id, contactId))
    .returning({ id: clientContacts.id });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
}

// ─────────────────────────── โปรเจกต์ ───────────────────────────

/** ชุดคอลัมน์มาตรฐานตอนไม่ได้เลือกแม่แบบ — ชื่อเปลี่ยนได้ ลำดับคือสิ่งที่มีความหมาย */
export const DEFAULT_BOARD = [
  { key: 'todo', name: 'รอเริ่ม' },
  { key: 'doing', name: 'กำลังทำ' },
  { key: 'review', name: 'รอตรวจ' },
  { key: 'done', name: 'เสร็จ' },
];
export const DEFAULT_TYPES = { a: 'งาน', b: 'บั๊ก', c: 'เอกสาร' };

export async function listProjects(tx: Tx, filter: { archived?: boolean; clientId?: string } = {}) {
  const where = [];
  if (filter.archived !== undefined) where.push(eq(projects.isArchived, filter.archived));
  if (filter.clientId) where.push(eq(projects.clientId, filter.clientId));

  const rows = await tx
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      color: projects.color,
      clientId: projects.clientId,
      clientName: clients.name,
      pmUserId: projects.pmUserId,
      startsOn: projects.startsOn,
      dueOn: projects.dueOn,
      isArchived: projects.isArchived,
      portalEnabled: projects.portalEnabled,
      deliveredAt: projects.deliveredAt,
      currentPhaseId: projects.currentPhaseId,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(projects.key));

  const taskCounts = await tx
    .select({ projectId: tasks.projectId, n: count() })
    .from(tasks)
    .groupBy(tasks.projectId);
  const byProject = new Map(taskCounts.map((r) => [r.projectId, r.n]));

  const phases = await tx
    .select({ id: projectPhases.id, name: projectPhases.name, kind: projectPhases.kind })
    .from(projectPhases);
  const phaseById = new Map(phases.map((p) => [p.id, p]));

  return rows.map((r) => ({
    ...r,
    taskCount: byProject.get(r.id) ?? 0,
    phase: r.currentPhaseId ? (phaseById.get(r.currentPhaseId) ?? null) : null,
  }));
}

/**
 * สร้างโปรเจกต์
 * รหัส (key) เปลี่ยนไม่ได้หลังสร้าง เพราะมันอยู่ในรหัสการ์ดทุกใบ (ACM-138)
 * และคนเอาไปอ้างกันในไลน์กับสแตนด์อัพแล้ว
 */
export async function createProject(
  tx: Tx,
  tenantId: string,
  input: {
    key: string;
    name: string;
    clientId: string;
    startsOn: string;
    dueOn: string;
    pmUserId?: string | null;
    board?: { key: string; name: string }[];
    typeLabels?: Record<string, string>;
  },
) {
  const key = input.key.trim().toUpperCase();
  // ตัวแรกต้องเป็นตัวอักษร ที่เหลือมีตัวเลขได้ — รหัสอย่าง E2E หรือ B2B ใช้กันจริง
  // ตัวแรกห้ามเป็นตัวเลข เพราะรหัสการ์ด (E2E-138) จะอ่านยากถ้าขึ้นต้นด้วยเลข
  if (!/^[A-Z][A-Z0-9]{1,4}$/.test(key)) {
    throw new ApiError(
      'E_INVALID',
      'รหัสโปรเจกต์ยาว 2–5 ตัว ขึ้นต้นด้วยตัวอักษรอังกฤษ ตามด้วยตัวอักษรหรือตัวเลข',
      'key',
    );
  }
  if (!input.name.trim()) throw new ApiError('E_INVALID', 'ต้องมีชื่อโปรเจกต์', 'name');

  const board = input.board ?? DEFAULT_BOARD;
  const problems = validateColumns(board);
  if (problems.length > 0) throw new ApiError('E_COLUMN_COUNT', problems.join(' · '), 'board');

  const dup = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.key, key))
    .limit(1);
  if (dup[0]) throw new ApiError('E_KEY_TAKEN', `รหัส ${key} ถูกใช้ไปแล้วในที่ทำงานนี้`, 'key');

  const rows = await tx
    .insert(projects)
    .values({
      tenantId,
      clientId: input.clientId,
      key,
      name: input.name.trim(),
      pmUserId: input.pmUserId ?? null,
      board,
      typeLabels: input.typeLabels ?? DEFAULT_TYPES,
      startsOn: input.startsOn,
      dueOn: input.dueOn,
    })
    .returning({ id: projects.id, key: projects.key });
  return rows[0];
}

export async function getProject(tx: Tx, projectId: string) {
  const rows = await tx
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      color: projects.color,
      clientId: projects.clientId,
      clientName: clients.name,
      pmUserId: projects.pmUserId,
      board: projects.board,
      typeLabels: projects.typeLabels,
      startsOn: projects.startsOn,
      dueOn: projects.dueOn,
      memberAccess: projects.memberAccess,
      isArchived: projects.isArchived,
      portalEnabled: projects.portalEnabled,
      deliveredAt: projects.deliveredAt,
      baselineTaskCount: projects.baselineTaskCount,
      currentPhaseId: projects.currentPhaseId,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const ph = await listPhases(tx, projectId);
  const ft = await listFeatures(tx, projectId);
  const [total] = await tx.select({ n: count() }).from(tasks).where(eq(tasks.projectId, projectId));

  return { ...p, phases: ph, features: ft, taskCount: total?.n ?? 0 };
}

/** รหัสโปรเจกต์เปลี่ยนไม่ได้ · คอลัมน์เปลี่ยนได้แต่ต้องอยู่ในช่วง 2–8 (กฎข้อ 8) */
export async function updateProject(tx: Tx, projectId: string, patch: Record<string, unknown>) {
  if (patch.key !== undefined) {
    throw new ApiError('E_INVALID', 'รหัสโปรเจกต์เปลี่ยนไม่ได้ เพราะอยู่ในรหัสการ์ดทุกใบแล้ว', 'key');
  }
  const set: Record<string, unknown> = {};
  if (typeof patch.name === 'string' && patch.name.trim()) set.name = patch.name.trim();
  if (typeof patch.color === 'string' && patch.color.trim()) set.color = patch.color.trim();
  if (patch.pmUserId !== undefined) set.pmUserId = patch.pmUserId || null;
  if (typeof patch.startsOn === 'string') set.startsOn = patch.startsOn;
  if (typeof patch.dueOn === 'string') set.dueOn = patch.dueOn;
  if (patch.memberAccess === 'collaborate' || patch.memberAccess === 'read_only') {
    set.memberAccess = patch.memberAccess;
  }
  if (patch.typeLabels && typeof patch.typeLabels === 'object') set.typeLabels = patch.typeLabels;

  if (Array.isArray(patch.board)) {
    const board = patch.board as { key: string; name: string }[];
    const problems = validateColumns(board);
    if (problems.length > 0) throw new ApiError('E_COLUMN_COUNT', problems.join(' · '), 'board');
    // ห้ามลบคอลัมน์ที่ยังมีการ์ดอยู่ ไม่งั้นการ์ดจะชี้ไปที่คอลัมน์ที่ไม่มีแล้ว
    const keys = new Set(board.map((c) => c.key));
    const used = await tx
      .selectDistinct({ columnKey: tasks.columnKey })
      .from(tasks)
      .where(eq(tasks.projectId, projectId));
    const orphan = used.map((u) => u.columnKey).filter((k) => !keys.has(k));
    if (orphan.length > 0) {
      throw new ApiError(
        'E_UNPROCESSABLE',
        `ยังมีการ์ดอยู่ในคอลัมน์ ${orphan.join(' · ')} ต้องย้ายการ์ดออกก่อนลบคอลัมน์`,
        'board',
      );
    }
    set.board = board;
  }

  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');
  const rows = await tx
    .update(projects)
    .set(set)
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
}

/** บันทึกจำนวนการ์ดตั้งต้น — ใช้เทียบว่างานบานปลายไปเท่าไรตอนส่งมอบ */
export async function lockBaseline(tx: Tx, projectId: string) {
  const [total] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.origin, 'delivery')));
  await tx
    .update(projects)
    .set({ baselineTaskCount: total?.n ?? 0, baselineLockedAt: new Date() })
    .where(eq(projects.id, projectId));
  return { baselineTaskCount: total?.n ?? 0 };
}

/**
 * ตัวเลขสุขภาพ — คำนวณสดทุกครั้ง ไม่เก็บเป็นคอลัมน์
 * กฎข้อ 9: ตัวเลขพวกนี้อยู่ระดับโปรเจกต์ ไม่ใช่ระดับคน จึงเอาไปเรียงลำดับคนไม่ได้
 */
export async function projectHealth(tx: Tx, projectId: string) {
  const rows = await tx
    .select({ baseline: projects.baselineTaskCount, board: projects.board })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const [delivery] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.origin, 'delivery')));
  const [unplanned] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(
      and(eq(tasks.projectId, projectId), isNull(tasks.featureId), eq(tasks.origin, 'delivery')),
    );
  const [warranty] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.origin, 'warranty')));

  // ตีกลับ = ลากถอยหลัง อ่านจากตำแหน่งคอลัมน์ที่บันทึกไว้ใน task_events
  const bounced = await tx.execute<{ n: number }>(sql`
    select count(*)::int as n from task_events e
    join tasks t on t.id = e.task_id
    where t.project_id = ${projectId}
      and e.from_column_index is not null
      and e.to_column_index is not null
      and e.to_column_index < e.from_column_index
  `);

  const baseline = p.baseline ?? 0;
  const now = delivery?.n ?? 0;
  return {
    baselineTaskCount: baseline,
    deliveryTasks: now,
    addedAfterBaseline: baseline > 0 ? now - baseline : null,
    unplannedTasks: unplanned?.n ?? 0,
    warrantyTasks: warranty?.n ?? 0,
    bounceCount: [...bounced][0]?.n ?? 0,
  };
}

// ─────────────────────────── เฟส ───────────────────────────

export async function listPhases(tx: Tx, projectId: string) {
  return tx
    .select({
      id: projectPhases.id,
      name: projectPhases.name,
      description: projectPhases.description,
      kind: projectPhases.kind,
      position: projectPhases.position,
      startedAt: projectPhases.startedAt,
      endedAt: projectPhases.endedAt,
    })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.position));
}

export async function addPhase(
  tx: Tx,
  tenantId: string,
  projectId: string,
  input: { name: string; kind?: 'normal' | 'delivery' | 'warranty'; description?: string },
) {
  const name = input.name.trim();
  if (!name) throw new ApiError('E_INVALID', 'ต้องมีชื่อเฟส', 'name');

  const existing = await listPhases(tx, projectId);
  const rows = await tx
    .insert(projectPhases)
    .values({
      tenantId,
      projectId,
      name,
      description: input.description?.trim() || null,
      kind: input.kind ?? 'normal',
      position: existing.length + 1,
    })
    .returning({ id: projectPhases.id });
  return rows[0];
}

/**
 * ย้ายโปรเจกต์เข้าเฟสนี้
 *
 * เฟสชนิด warranty คือสวิตช์ที่เปิดพอร์ทัลลูกค้าและ SLA
 * `portal_enabled` คำนวณจากเฟส ไม่ให้ตั้งเองโดยตรง — ไม่งั้นจะมีคนเปิดพอร์ทัล
 * ทั้งที่ยังไม่ได้ส่งมอบ แล้วลูกค้าจะเห็นงานที่ยังทำไม่เสร็จ
 */
export async function enterPhase(tx: Tx, projectId: string, phaseId: string) {
  const rows = await tx
    .select({ id: projectPhases.id, kind: projectPhases.kind })
    .from(projectPhases)
    .where(and(eq(projectPhases.id, phaseId), eq(projectPhases.projectId, projectId)))
    .limit(1);
  const phase = rows[0];
  if (!phase) throw new ApiError('E_NOT_FOUND');

  const now = new Date();
  // ปิดเฟสเดิมที่ยังเปิดค้างอยู่ก่อน
  await tx
    .update(projectPhases)
    .set({ endedAt: now })
    .where(and(eq(projectPhases.projectId, projectId), isNull(projectPhases.endedAt)));

  await tx
    .update(projectPhases)
    .set({ startedAt: now, endedAt: null })
    .where(eq(projectPhases.id, phaseId));
  await tx
    .update(projects)
    .set({ currentPhaseId: phaseId, portalEnabled: phase.kind === 'warranty' })
    .where(eq(projects.id, projectId));

  return { phaseId, portalEnabled: phase.kind === 'warranty' };
}

// ─────────────────────────── งานหลัก ───────────────────────────

/**
 * งานหลักไม่มีคอลัมน์วันที่โดยตั้งใจ
 * ช่วงงานคำนวณสดจากการ์ดลูก: start = MIN(start_date ?? due_date) · end = MAX(due_date)
 * ถ้าเก็บวันที่ไว้เอง วันหนึ่งมันจะไม่ตรงกับการ์ดจริง แล้วไม่มีใครรู้ว่าอันไหนถูก
 */
export async function listFeatures(tx: Tx, projectId: string) {
  const rows = await tx
    .select({
      id: features.id,
      name: features.name,
      color: features.color,
      position: features.position,
    })
    .from(features)
    .where(eq(features.projectId, projectId))
    .orderBy(asc(features.position));

  const spans = await tx.execute<{
    feature_id: string;
    starts: string | null;
    ends: string | null;
    n: number;
  }>(sql`
    select feature_id,
           min(coalesce(start_date, due_date))::text as starts,
           max(due_date)::text as ends,
           count(*)::int as n
    from tasks
    where project_id = ${projectId} and feature_id is not null
    group by feature_id
  `);
  const byId = new Map([...spans].map((s) => [s.feature_id, s]));

  return rows.map((r) => {
    const s = byId.get(r.id);
    return { ...r, taskCount: s?.n ?? 0, startsOn: s?.starts ?? null, endsOn: s?.ends ?? null };
  });
}

export async function addFeature(
  tx: Tx,
  tenantId: string,
  projectId: string,
  input: { name: string; color?: string },
) {
  const name = input.name.trim();
  if (!name) throw new ApiError('E_INVALID', 'ต้องมีชื่องานหลัก', 'name');
  const existing = await listFeatures(tx, projectId);
  const rows = await tx
    .insert(features)
    .values({
      tenantId,
      projectId,
      name,
      color: input.color?.trim() || '#5B5BD6',
      position: existing.length + 1,
    })
    .returning({ id: features.id });
  return rows[0];
}

export async function updateFeature(
  tx: Tx,
  featureId: string,
  patch: { name?: string; color?: string; position?: number },
) {
  const set: Record<string, string | number> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.color?.trim()) set.color = patch.color.trim();
  if (typeof patch.position === 'number') set.position = patch.position;
  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

  const rows = await tx
    .update(features)
    .set(set)
    .where(eq(features.id, featureId))
    .returning({ id: features.id, projectId: features.projectId });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
  return rows[0];
}

/**
 * ลบงานหลัก — **การ์ดลูกต้องไม่ถูกลบ** กลายเป็นงานนอกแผนแทน
 *
 * ต้องเคลียร์ feature_id ก่อนเสมอ ไม่ใช่พึ่ง ON DELETE ของฐานข้อมูล
 * เพราะ FK ตั้งเป็น NO ACTION การลบตรงๆ จะถูกปฏิเสธ
 * และถ้าวันหนึ่งมีคนเปลี่ยนเป็น CASCADE การ์ดจะหายไปทั้งชุดโดยไม่มีใครทัน
 */
export async function deleteFeature(tx: Tx, featureId: string) {
  const rows = await tx
    .select({ id: features.id, projectId: features.projectId })
    .from(features)
    .where(eq(features.id, featureId))
    .limit(1);
  const f = rows[0];
  if (!f) throw new ApiError('E_NOT_FOUND');

  const [affected] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(eq(tasks.featureId, featureId));

  await tx.update(tasks).set({ featureId: null }).where(eq(tasks.featureId, featureId));
  await tx.delete(features).where(eq(features.id, featureId));

  return { projectId: f.projectId, tasksBecameUnplanned: affected?.n ?? 0 };
}

// ─────────────────────────── Timeline ───────────────────────────

export interface TimelineLane {
  id: string;
  name: string;
  color: string;
  /** null = ยังไม่มีการ์ดที่มีวันที่ · หน้าจอวาดเป็นแท่งเส้นประ */
  startsOn: string | null;
  endsOn: string | null;
  taskCount: number;
  doneCount: number;
  /** งานนอกแผน — เลนล่างสุด เห็นทันทีว่ากินเวลาไปแค่ไหน */
  isUnplanned: boolean;
}

export interface Timeline {
  projectKey: string;
  projectName: string;
  startsOn: string;
  dueOn: string;
  /** ขอบเขตจริงที่ต้องวาด — กว้างกว่ากรอบโปรเจกต์ได้ถ้างานล้นออกไป */
  windowStart: string;
  windowEnd: string;
  lanes: TimelineLane[];
}

/**
 * Timeline ตามงานหลัก
 *
 * ═══ แท่งคำนวณสดจากการ์ดลูกเสมอ ═══
 * งานหลักไม่มีคอลัมน์วันที่โดยตั้งใจ (ดูพจนานุกรมข้อมูล)
 * ถ้าเก็บวันที่ไว้เอง วันหนึ่งมันจะไม่ตรงกับการ์ดจริง แล้วไม่มีใครรู้ว่าอันไหนถูก
 *   start = MIN(COALESCE(start_date, due_date))
 *   end   = MAX(due_date)
 *
 * ไม่มีเส้นเชื่อมความสัมพันธ์ระหว่างงาน — ตัดออกโดยตั้งใจ
 * ทีม 5–50 คนแทบไม่ได้ใช้ และมันดึงต้นทุนอีก 3–4 สัปดาห์
 */
export async function projectTimeline(tx: Tx, projectId: string): Promise<Timeline> {
  const rows = await tx
    .select({
      key: projects.key,
      name: projects.name,
      startsOn: projects.startsOn,
      dueOn: projects.dueOn,
      board: projects.board,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const board = (p.board as { key: string; name: string }[]) ?? [];
  const lastKey = board[board.length - 1]?.key ?? '';

  const spans = await tx.execute<{
    feature_id: string | null;
    feature_name: string | null;
    color: string | null;
    position: number | null;
    starts: string | null;
    ends: string | null;
    n: number;
    done: number;
  }>(sql`
    select t.feature_id,
           f.name  as feature_name,
           f.color as color,
           f.position as position,
           min(coalesce(t.start_date, t.due_date))::text as starts,
           max(t.due_date)::text as ends,
           count(*)::int as n,
           count(*) filter (where t.column_key = ${lastKey})::int as done
    from tasks t
    left join features f on f.id = t.feature_id
    where t.project_id = ${projectId} and t.origin = 'delivery'
    group by t.feature_id, f.name, f.color, f.position
  `);
  const byFeature = new Map([...spans].map((s) => [s.feature_id ?? '', s]));

  // งานหลักทุกอันต้องมีเลน แม้ยังไม่มีการ์ด — จะได้เห็นว่ายังไม่ได้เริ่ม
  const allFeatures = await tx
    .select({
      id: features.id,
      name: features.name,
      color: features.color,
      position: features.position,
    })
    .from(features)
    .where(eq(features.projectId, projectId))
    .orderBy(asc(features.position));

  const lanes: TimelineLane[] = allFeatures.map((f) => {
    const s = byFeature.get(f.id);
    return {
      id: f.id,
      name: f.name,
      color: f.color,
      startsOn: s?.starts ?? null,
      endsOn: s?.ends ?? null,
      taskCount: s?.n ?? 0,
      doneCount: s?.done ?? 0,
      isUnplanned: false,
    };
  });

  const orphan = byFeature.get('');
  if (orphan && orphan.n > 0) {
    lanes.push({
      id: '',
      name: 'งานนอกแผน',
      // สีเตือนจากตัวแปรในระบบดีไซน์ ไม่ได้คิดสีใหม่
      color: 'var(--danger)',
      startsOn: orphan.starts,
      endsOn: orphan.ends,
      taskCount: orphan.n,
      doneCount: orphan.done,
      isUnplanned: true,
    });
  }

  // ขอบเขตที่ต้องวาด — กว้างกว่ากรอบโปรเจกต์ได้ถ้างานล้นออกไป
  // ถ้าตัดที่กรอบโปรเจกต์ แท่งที่เลยกำหนดจะหายไปจากจอ ซึ่งเป็นแท่งที่สำคัญที่สุด
  const dates = lanes.flatMap((l) => [l.startsOn, l.endsOn]).filter((d): d is string => Boolean(d));
  const windowStart = [p.startsOn, ...dates].sort()[0] ?? p.startsOn;
  const windowEnd = [p.dueOn, ...dates].sort().at(-1) ?? p.dueOn;

  return {
    projectKey: p.key,
    projectName: p.name,
    startsOn: p.startsOn,
    dueOn: p.dueOn,
    windowStart,
    windowEnd,
    lanes,
  };
}
