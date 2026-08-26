/**
 * ตรรกะของ M4 — การ์ดและมุมมองตาราง
 *
 * ═══ สิ่งที่ไฟล์นี้ตั้งใจไม่ทำ ═══
 * ไม่มีฟังก์ชันไหนที่เปลี่ยน `column_key` ได้ — นั่นเป็นเรื่องของ transition (M5)
 * และ trigger ที่ฐานข้อมูลจะปฏิเสธถ้ามีใครพยายามเลี่ยง (กฎข้อ 4)
 */

import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { attachments, comments, features, projects, taskEvents, tasks, users } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { findMentioned, notify } from '@/lib/notify';
import { startClock } from './sla';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TypeSlot = 'a' | 'b' | 'c';
export type Eta = 'today' | 'tomorrow' | 'this_week' | 'unknown';

/** ฟิลด์ที่ห้ามแก้ผ่าน PATCH — แต่ละตัวมีประตูของตัวเอง */
const FORBIDDEN_IN_PATCH: Record<string, string> = {
  column_key: 'POST /tasks/:id/transition',
  columnKey: 'POST /tasks/:id/transition',
  portal_stage: 'POST /tasks/:id/portal-stage',
  portalStage: 'POST /tasks/:id/portal-stage',
};

interface BoardColumn {
  key: string;
  name: string;
}

async function boardOf(tx: Tx, projectId: string): Promise<BoardColumn[]> {
  const rows = await tx
    .select({ board: projects.board })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const b = rows[0]?.board;
  if (!Array.isArray(b)) throw new ApiError('E_NOT_FOUND');
  return b as BoardColumn[];
}

// ─────────────────────────── อ่านการ์ด ───────────────────────────

export interface TaskFilter {
  featureId?: string;
  columnKey?: string;
  assigneeId?: string;
  typeSlot?: TypeSlot;
  origin?: 'delivery' | 'warranty';
  unplanned?: boolean;
}

export async function listTasks(tx: Tx, projectId: string, f: TaskFilter = {}) {
  const where = [eq(tasks.projectId, projectId)];
  if (f.featureId) where.push(eq(tasks.featureId, f.featureId));
  if (f.unplanned) where.push(isNull(tasks.featureId));
  if (f.columnKey) where.push(eq(tasks.columnKey, f.columnKey));
  if (f.assigneeId) where.push(eq(tasks.assigneeId, f.assigneeId));
  if (f.typeSlot) where.push(eq(tasks.typeSlot, f.typeSlot));
  if (f.origin) where.push(eq(tasks.origin, f.origin));

  const rows = await tx
    .select({
      id: tasks.id,
      number: tasks.number,
      title: tasks.title,
      columnKey: tasks.columnKey,
      typeSlot: tasks.typeSlot,
      priority: tasks.priority,
      origin: tasks.origin,
      warrantyScope: tasks.warrantyScope,
      featureId: tasks.featureId,
      featureName: features.name,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      dueDate: tasks.dueDate,
      startDate: tasks.startDate,
      eta: tasks.eta,
      position: tasks.position,
      isClientVisible: tasks.isClientVisible,
    })
    .from(tasks)
    .leftJoin(features, eq(features.id, tasks.featureId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(and(...where))
    .orderBy(asc(tasks.position), asc(tasks.number));

  const board = await boardOf(tx, projectId);
  const keyProject = await tx
    .select({ key: projects.key })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const prefix = keyProject[0]?.key ?? '';

  /**
   * "ถือมากี่วัน" คำนวณสดจาก task_events — เวลาที่เข้าคอลัมน์ปัจจุบันครั้งล่าสุด
   * ไม่เก็บเป็นคอลัมน์เพราะมันเปลี่ยนทุกวันโดยไม่มีใครแตะการ์ด
   */
  const held = await tx.execute<{ task_id: string; days: number }>(sql`
    select t.id as task_id,
           greatest(0, floor(extract(epoch from (now() - coalesce(
             (select max(e.at) from task_events e
               where e.task_id = t.id and e.to_column_key = t.column_key),
             t.created_at))) / 86400))::int as days
    from tasks t where t.project_id = ${projectId}
  `);
  const heldBy = new Map([...held].map((h) => [h.task_id, h.days]));

  return rows.map((r) => {
    const idx = board.findIndex((c) => c.key === r.columnKey);
    return {
      ...r,
      code: `${prefix}-${r.number}`,
      columnName: board[idx]?.name ?? r.columnKey,
      columnIndex: idx < 0 ? 0 : idx,
      // ปิดงานแล้วหรือยัง = อยู่คอลัมน์สุดท้ายหรือเปล่า · คำนวณสด ไม่ได้เก็บ
      isClosed: idx === board.length - 1,
      heldDays: heldBy.get(r.id) ?? 0,
    };
  });
}

export async function getTask(tx: Tx, taskId: string) {
  const rows = await tx
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      projectKey: projects.key,
      board: projects.board,
      typeLabels: projects.typeLabels,
      pmUserId: projects.pmUserId,
      number: tasks.number,
      title: tasks.title,
      description: tasks.description,
      columnKey: tasks.columnKey,
      typeSlot: tasks.typeSlot,
      priority: tasks.priority,
      reportedImpact: tasks.reportedImpact,
      origin: tasks.origin,
      warrantyScope: tasks.warrantyScope,
      portalStage: tasks.portalStage,
      featureId: tasks.featureId,
      featureName: features.name,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      eta: tasks.eta,
      etaUpdatedAt: tasks.etaUpdatedAt,
      isClientVisible: tasks.isClientVisible,
      createdAt: tasks.createdAt,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(features, eq(features.id, tasks.featureId))
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(eq(tasks.id, taskId))
    .limit(1);

  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');

  const board = (t.board as BoardColumn[]) ?? [];
  const idx = board.findIndex((c) => c.key === t.columnKey);

  return {
    ...t,
    code: `${t.projectKey}-${t.number}`,
    columnName: board[idx]?.name ?? t.columnKey,
    columnIndex: idx < 0 ? 0 : idx,
    columnCount: board.length,
    isClosed: idx === board.length - 1,
  };
}

/** ประวัติการ์ด — อ่านจาก task_events ซึ่งเขียนอย่างเดียว ลบไม่ได้ (กฎข้อ 5) */
export async function taskHistory(tx: Tx, taskId: string) {
  return tx
    .select({
      id: taskEvents.id,
      at: taskEvents.at,
      fromColumnName: taskEvents.fromColumnName,
      toColumnName: taskEvents.toColumnName,
      fromColumnIndex: taskEvents.fromColumnIndex,
      toColumnIndex: taskEvents.toColumnIndex,
      fromPortalStage: taskEvents.fromPortalStage,
      toPortalStage: taskEvents.toPortalStage,
      reason: taskEvents.reason,
      actorName: users.name,
    })
    .from(taskEvents)
    .leftJoin(users, eq(users.id, taskEvents.actorId))
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(desc(taskEvents.at));
}

// ─────────────────────────── สร้างและแก้การ์ด ───────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string;
  typeSlot?: TypeSlot;
  priority?: Priority;
  featureId?: string | null;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  origin?: 'delivery' | 'warranty';
  isClientVisible?: boolean;
  /** ลูกค้าเป็นคนแจ้งเอง — เก็บที่ actor_contact_id ไม่ใช่ actor_id (คนละตาราง) */
  actorContactId?: string | null;
  /** วินาทีที่ลูกค้ากดส่ง — พอร์ทัลส่งมาให้ ไม่งั้นใช้เวลาปัจจุบัน */
  submittedAt?: Date;
}

/**
 * สร้างการ์ด — **ลงคอลัมน์แรกเสมอ ไม่รับพารามิเตอร์คอลัมน์** (กฎข้อ 8)
 *
 * ถ้าให้เลือกคอลัมน์ตอนสร้างได้ จะมีคนสร้างการ์ดลงคอลัมน์ "เสร็จ" โดยตรง
 * แล้ว task_events จะไม่มีร่องรอยว่ามันเคยผ่านขั้นไหนมาบ้าง
 * ซึ่งทำให้ "ถือมากี่วัน" กับสถิติรอบตีกลับเชื่อถือไม่ได้ทั้งระบบ
 *
 * เลขการ์ดเพิ่มด้วย UPDATE ... RETURNING ในธุรกรรมเดียวกัน
 * ไม่ใช่อ่านมาบวกหนึ่งแล้วเขียนกลับ ไม่งั้นสองคนกดพร้อมกันจะได้เลขชนกัน
 */
export async function createTask(
  tx: Tx,
  tenantId: string,
  projectId: string,
  /** ว่างได้เมื่อคนแจ้งคือลูกค้า ไม่ใช่คนในทีม — ดู input.actorContactId */
  actorId: string | null,
  input: CreateTaskInput,
): Promise<{ id: string; number: number; code: string }> {
  const title = input.title.trim();
  if (!title) throw new ApiError('E_INVALID', 'ต้องมีชื่อการ์ด', 'title');

  const board = await boardOf(tx, projectId);
  const first = board[0];
  if (!first) throw new ApiError('E_UNPROCESSABLE', 'โปรเจกต์นี้ยังไม่มีคอลัมน์บนบอร์ด');

  const bumped = await tx.execute<{ number: number; key: string }>(sql`
    update projects
       set next_task_number = next_task_number + 1
     where id = ${projectId}
     returning next_task_number - 1 as number, key
  `);
  const got = [...bumped][0];
  if (!got) throw new ApiError('E_NOT_FOUND');

  // การ์ดใหม่ไปท้ายคอลัมน์แรกเสมอ
  const [last] = await tx
    .select({ n: sql<number>`coalesce(max(position), 0)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.columnKey, first.key)));

  const rows = await tx
    .insert(tasks)
    .values({
      tenantId,
      projectId,
      number: got.number,
      title,
      description: input.description?.trim() || null,
      columnKey: first.key,
      typeSlot: input.typeSlot ?? 'a',
      priority: input.priority ?? 'medium',
      featureId: input.featureId ?? null,
      assigneeId: input.assigneeId ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      origin: input.origin ?? 'delivery',
      isClientVisible: input.isClientVisible ?? false,
      contactId: input.actorContactId ?? null,
      position: Number(last?.n ?? 0) + 1,
      createdBy: actorId,
    })
    .returning({ id: tasks.id });

  const created = rows[0];
  if (!created) throw new ApiError('E_UNPROCESSABLE', 'สร้างการ์ดไม่สำเร็จ');

  // เขียนประวัติแถวแรกพร้อมชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้น (กฎข้อ 5)
  await tx.insert(taskEvents).values({
    tenantId,
    taskId: created.id,
    toColumnKey: first.key,
    toColumnName: first.name,
    toColumnIndex: 0,
    columnCount: board.length,
    toUserId: input.assigneeId ?? null,
    actorId,
    actorContactId: input.actorContactId ?? null,
  });

  /**
   * เรื่องประกัน = นาฬิกา SLA เริ่มเดินทันที ณ วินาทีนี้ (ตัดสิน 20 ส.ค. 2569)
   * ไม่รอให้เจ้าหน้าที่กดรับเรื่อง เพราะเวลาที่เรื่องนอนรอคือเวลาที่ลูกค้ารอจริง
   */
  if ((input.origin ?? 'delivery') === 'warranty') {
    const [proj] = await tx
      .select({ clientId: projects.clientId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (proj) {
      await startClock(
        tx,
        tenantId,
        created.id,
        proj.clientId,
        input.priority ?? 'medium',
        input.submittedAt ?? new Date(),
      );
    }
  }

  return { id: created.id, number: got.number, code: `${got.key}-${got.number}` };
}

/**
 * แก้การ์ด — ทุกฟิลด์ยกเว้น column_key และ portal_stage
 *
 * ═══ เกณฑ์ผ่านของ M4 ═══
 * ถ้ามี column_key ปนมาใน body ต้องตอบ 400 ไม่ใช่เงียบๆ ไม่สนใจมัน
 * เพราะถ้าเงียบ คนเรียกจะเข้าใจว่าย้ายสำเร็จแล้วทั้งที่ไม่ได้ย้าย
 * trigger ที่ฐานข้อมูลกันไว้อีกชั้นเผื่อมีทางไหนเล็ดลอดมาได้
 */
export async function updateTask(
  tx: Tx,
  taskId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  for (const [field, gate] of Object.entries(FORBIDDEN_IN_PATCH)) {
    if (patch[field] !== undefined) {
      throw new ApiError('E_COLUMN_NOT_PATCHABLE', `แก้ ${field} ทางนี้ไม่ได้ ต้องใช้ ${gate}`, field);
    }
  }

  const set: Record<string, unknown> = {};
  if (typeof patch.title === 'string' && patch.title.trim()) set.title = patch.title.trim();
  if (patch.description !== undefined) {
    set.description =
      typeof patch.description === 'string' ? patch.description.trim() || null : null;
  }
  if (['a', 'b', 'c'].includes(String(patch.typeSlot))) set.typeSlot = patch.typeSlot;
  if (['low', 'medium', 'high', 'critical'].includes(String(patch.priority))) {
    set.priority = patch.priority;
  }
  if (patch.featureId !== undefined) set.featureId = patch.featureId || null;
  if (patch.assigneeId !== undefined) set.assigneeId = patch.assigneeId || null;
  if (patch.startDate !== undefined) set.startDate = patch.startDate || null;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate || null;
  if (typeof patch.isClientVisible === 'boolean') set.isClientVisible = patch.isClientVisible;

  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

  const rows = await tx
    .update(tasks)
    .set(set)
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
}

/**
 * คำตอบ "จะเสร็จเมื่อไร" — แยกจาก due_date โดยตั้งใจ
 * due_date คือสัญญากับลูกค้า · eta คือความเห็นล่าสุดของคนทำ
 * เก็บเวลาที่ตอบไว้ด้วย เพราะคำตอบที่เก่ากว่า 3 วันถือว่าหมดอายุ
 */
export async function setEta(tx: Tx, taskId: string, eta: Eta): Promise<void> {
  const rows = await tx
    .update(tasks)
    .set({ eta, etaUpdatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
}

/**
 * ลบการ์ดจริง — เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน
 *
 * task_events ของการ์ดนั้นลบไม่ได้ (role app ถูก REVOKE DELETE ไว้ · กฎข้อ 5)
 * จึงต้องตัด FK ให้ขาดก่อน ไม่งั้นลบการ์ดไม่ผ่าน
 * ผลคือเหตุการณ์ยังอยู่ในฐานข้อมูลเป็นหลักฐานว่าเคยมีการ์ดใบนี้
 */
export async function deleteTask(tx: Tx, taskId: string): Promise<void> {
  const rows = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');

  await tx.delete(comments).where(eq(comments.taskId, taskId));
  // ไม่ต้องแตะ task_events เอง — FK เป็น ON DELETE SET NULL ฐานข้อมูลตัดให้
  // (แตะเองไม่ได้อยู่แล้วเพราะ role app ถูก REVOKE UPDATE ตามกฎข้อ 5)
  await tx.delete(tasks).where(eq(tasks.id, taskId));
}

// ─────────────────────────── คอมเมนต์ ───────────────────────────

/**
 * กฎข้อ 6 — ค่าเริ่มต้นของ is_internal เป็น true
 * พลาดทางนี้ปลอดภัยกว่า: ลืมตั้งแล้วลูกค้าไม่เห็น ดีกว่าลืมตั้งแล้วลูกค้าเห็นของภายใน
 */
export async function listComments(tx: Tx, taskId: string, forClient = false) {
  const where = [eq(comments.taskId, taskId)];
  if (forClient) where.push(eq(comments.isInternal, false));

  return tx
    .select({
      id: comments.id,
      body: comments.body,
      isInternal: comments.isInternal,
      isSystem: comments.isSystem,
      createdAt: comments.createdAt,
      authorName: users.name,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(...where))
    .orderBy(asc(comments.createdAt));
}

export async function addComment(
  tx: Tx,
  tenantId: string,
  taskId: string,
  authorId: string,
  input: { body: string; isInternal?: boolean },
) {
  const text = input.body.trim();
  if (!text) throw new ApiError('E_INVALID', 'คอมเมนต์ว่างไม่ได้', 'body');

  const rows = await tx
    .insert(comments)
    .values({
      tenantId,
      taskId,
      authorId,
      body: text,
      isInternal: input.isInternal ?? true,
      isSystem: false,
    })
    .returning({ id: comments.id });

  /**
   * แจ้งคนที่ถูกพูดถึงด้วย `@อีเมล`
   *
   * ใช้อีเมลไม่ใช่ชื่อ เพราะชื่อคนไทยมีช่องว่างและซ้ำกันได้ ตัดคำไม่ได้แน่นอน
   * `notify()` กรองคนที่พิมพ์เองออกให้แล้ว และไม่โยนข้อผิดพลาดออกมา
   */
  for (const userId of await findMentioned(tx, text)) {
    await notify(tx, {
      tenantId,
      taskId,
      actorId: authorId,
      recipientId: userId,
      kind: 'mentioned',
      body: text,
    });
  }

  return rows[0];
}

/** นับการ์ดต่อคอลัมน์ — ใช้ทำหัวคอลัมน์บนบอร์ดโดยไม่ต้องดึงการ์ดทั้งหมด */
export async function countByColumn(tx: Tx, projectId: string) {
  const rows = await tx
    .select({ columnKey: tasks.columnKey, n: count() })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.columnKey);
  return Object.fromEntries(rows.map((r) => [r.columnKey, r.n]));
}

// ─────────────────────────── ไฟล์แนบ ───────────────────────────

/**
 * ไฟล์ทั้งโปรเจกต์ — รวมทั้งไฟล์ที่แนบกับการ์ดและไฟล์ระดับโปรเจกต์
 * ไม่คืน storage_key ออกไปข้างนอก เพราะมันคือที่อยู่จริงของไฟล์
 * ต้องขอลิงก์ดาวน์โหลดผ่าน /attachments/:id/download ซึ่งตรวจสิทธิ์ทุกครั้ง
 */
export async function listFiles(tx: Tx, projectId: string) {
  return tx
    .select({
      id: attachments.id,
      filename: attachments.filename,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      taskId: attachments.taskId,
      taskNumber: tasks.number,
      taskTitle: tasks.title,
      uploadedByName: users.name,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .leftJoin(tasks, eq(tasks.id, attachments.taskId))
    .leftJoin(users, eq(users.id, attachments.uploadedBy))
    .where(eq(attachments.projectId, projectId))
    .orderBy(desc(attachments.createdAt));
}

export async function recordAttachment(
  tx: Tx,
  tenantId: string,
  input: {
    projectId: string;
    taskId?: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
    uploadedBy: string;
  },
) {
  const rows = await tx
    .insert(attachments)
    .values({
      tenantId,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageProvider: 'spaces',
      storageKey: input.storageKey,
      uploadedBy: input.uploadedBy,
    })
    .returning({ id: attachments.id });
  return rows[0];
}

export async function getAttachment(tx: Tx, attachmentId: string) {
  const rows = await tx
    .select({
      id: attachments.id,
      projectId: attachments.projectId,
      filename: attachments.filename,
      storageKey: attachments.storageKey,
    })
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  const a = rows[0];
  if (!a) throw new ApiError('E_NOT_FOUND');
  return a;
}

export async function removeAttachment(tx: Tx, attachmentId: string) {
  const rows = await tx
    .delete(attachments)
    .where(eq(attachments.id, attachmentId))
    .returning({ storageKey: attachments.storageKey });
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND');
  return row;
}
