/**
 * งานประกันและ SLA — M10
 *
 * ═══ ตัวแยกจากคู่แข่งของสินค้านี้ ═══
 * CLAUDE.md เขียนว่า "ถ้าต้องตัดอะไรเพื่อให้ทัน ตัดที่อื่นก่อน"
 *
 * ═══ นาฬิกาเริ่มเดินตอนลูกค้ากดส่ง ═══
 * ตัดสิน 20 ส.ค. 2569 · ขัดกับ `screens/38.md` ที่เขียนว่านาฬิกาไม่เดินจนกว่าจะคัดแยกเสร็จ
 * เลือกตามการตัดสินใจล่าสุด — เวลาที่เรื่องนอนรอเป็นเวลาที่ลูกค้ารอจริง
 * แต่แยกให้เห็นว่าใช้ไปกับการคัดแยกเท่าไร (`minutesBeforeTriage`)
 * ทีมจะได้รู้ว่าเสียเวลาตรงไหน ไม่ใช่ซ่อนมันไว้
 *
 * ═══ ยอดรวมคำนวณสดจาก sla_clock_events เสมอ ═══
 * ไม่เก็บยอดสะสมในคอลัมน์ใด เพราะแก้ย้อนหลังแล้วจะพิสูจน์ไม่ได้
 */

import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import {
  clients,
  projectPhases,
  projects,
  slaClockEvents,
  slaClocks,
  slaPolicies,
  slaPolicyLevels,
  taskEvents,
  tasks,
  tenants,
  warrantyContracts,
} from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import {
  addBusinessMinutes,
  type BusinessHours,
  businessMinutesBetween,
  DEFAULT_HOURS,
} from './business-hours';
import { enterPhase, projectHealth } from './projects';

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WarrantyScope = 'pending' | 'covered' | 'billable' | 'not_ours';

/** ค่าเริ่มต้นของนโยบาย SLA — ทีมปรับได้ที่หน้าสัญญา */
export const DEFAULT_LEVELS: Record<Priority, { respond: number; resolve: number }> = {
  critical: { respond: 60, resolve: 8 * 60 },
  high: { respond: 4 * 60, resolve: 16 * 60 },
  medium: { respond: 8 * 60, resolve: 40 * 60 },
  low: { respond: 16 * 60, resolve: 80 * 60 },
};

async function hoursOf(tx: Tx, tenantId: string): Promise<BusinessHours> {
  const rows = await tx
    .select({ bh: tenants.businessHours })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const bh = rows[0]?.bh as BusinessHours | undefined;
  return bh?.days ? bh : DEFAULT_HOURS;
}

// ─────────────────────────── นโยบายและสัญญา ───────────────────────────

/**
 * นโยบายเก็บเป็นเวอร์ชัน — แก้แล้วเรื่องเก่าใช้ค่าเดิม
 *
 * เกณฑ์ผ่านของ M10 ข้อสาม
 * ทำได้เพราะ `sla_clocks` **คัดลอกเวลาเป้าหมายมาเก็บตอนสร้าง** ไม่ได้ join ตอนอ่าน
 */
export async function currentPolicy(tx: Tx, clientId: string) {
  const rows = await tx
    .select({
      id: slaPolicies.id,
      version: slaPolicies.version,
      countBusinessHours: slaPolicies.countBusinessHours,
      pauseOnCustomer: slaPolicies.pauseOnCustomer,
      pauseOnVendor: slaPolicies.pauseOnVendor,
    })
    .from(slaPolicies)
    .where(eq(slaPolicies.clientId, clientId))
    .orderBy(desc(slaPolicies.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function policyLevels(tx: Tx, policyId: string) {
  const rows = await tx
    .select({
      priority: slaPolicyLevels.priority,
      respondMinutes: slaPolicyLevels.respondMinutes,
      resolveMinutes: slaPolicyLevels.resolveMinutes,
    })
    .from(slaPolicyLevels)
    .where(eq(slaPolicyLevels.policyId, policyId));
  return rows;
}

/**
 * บันทึกนโยบายเป็นเวอร์ชันใหม่ — ไม่ทับของเดิม
 * เรื่องที่เปิดอยู่แล้วยังใช้เวอร์ชันเดิมต่อไป เพราะนาฬิกาล็อกค่าไว้แล้ว
 */
export async function saveContract(
  tx: Tx,
  tenantId: string,
  clientId: string,
  input: {
    countBusinessHours?: boolean;
    pauseOnCustomer?: boolean;
    pauseOnVendor?: boolean;
    levels?: Partial<Record<Priority, { respond: number; resolve: number }>>;
  },
) {
  const prev = await currentPolicy(tx, clientId);
  const version = (prev?.version ?? 0) + 1;

  const created = await tx
    .insert(slaPolicies)
    .values({
      tenantId,
      clientId,
      version,
      countBusinessHours: input.countBusinessHours ?? prev?.countBusinessHours ?? true,
      pauseOnCustomer: input.pauseOnCustomer ?? prev?.pauseOnCustomer ?? true,
      pauseOnVendor: input.pauseOnVendor ?? prev?.pauseOnVendor ?? true,
    })
    .returning({ id: slaPolicies.id });
  const policyId = created[0]?.id;
  if (!policyId) throw new ApiError('E_UNPROCESSABLE', 'บันทึกนโยบายไม่สำเร็จ');

  // สี่ระดับเสมอ — ถ้าไม่ส่งมาใช้ค่าเดิมหรือค่าเริ่มต้น
  const prevLevels = prev ? await policyLevels(tx, prev.id) : [];
  const byPriority = new Map(prevLevels.map((l) => [l.priority, l]));

  for (const p of ['low', 'medium', 'high', 'critical'] as Priority[]) {
    const given = input.levels?.[p];
    const old = byPriority.get(p);
    await tx.insert(slaPolicyLevels).values({
      tenantId,
      policyId,
      priority: p,
      respondMinutes: given?.respond ?? old?.respondMinutes ?? DEFAULT_LEVELS[p].respond,
      resolveMinutes: given?.resolve ?? old?.resolveMinutes ?? DEFAULT_LEVELS[p].resolve,
    });
  }
  return { policyId, version };
}

// ─────────────────────────── นาฬิกา ───────────────────────────

/**
 * เริ่มนาฬิกาเมื่อลูกค้ากดส่ง
 *
 * **คัดลอกเวลาเป้าหมายมาเก็บที่นี่เลย** ไม่ join กลับไปที่นโยบายตอนอ่าน
 * นี่คือเหตุผลที่เปลี่ยนนโยบายแล้วเรื่องเก่ายังใช้ค่าเดิม (เกณฑ์ผ่านข้อสาม)
 */
export async function startClock(
  tx: Tx,
  tenantId: string,
  taskId: string,
  clientId: string,
  priority: Priority,
  at: Date = new Date(),
) {
  const existing = await tx
    .select({ id: slaClocks.id })
    .from(slaClocks)
    .where(eq(slaClocks.taskId, taskId))
    .limit(1);
  if (existing[0]) return existing[0];

  let policy = await currentPolicy(tx, clientId);
  if (!policy) {
    // ยังไม่เคยตั้งสัญญา — สร้างเวอร์ชันแรกด้วยค่าเริ่มต้น จะได้มีอะไรให้ล็อก
    const made = await saveContract(tx, tenantId, clientId, {});
    policy = await currentPolicy(tx, clientId);
    if (!policy) throw new ApiError('E_UNPROCESSABLE', `ตั้งนโยบายไม่สำเร็จ (${made.version})`);
  }

  const levels = await policyLevels(tx, policy.id);
  const level = levels.find((l) => l.priority === priority);
  const fallback = DEFAULT_LEVELS[priority];

  const rows = await tx
    .insert(slaClocks)
    .values({
      tenantId,
      taskId,
      policyId: policy.id,
      targetRespondMinutes: level?.respondMinutes ?? fallback.respond,
      targetResolveMinutes: level?.resolveMinutes ?? fallback.resolve,
      state: 'running',
    })
    .returning({ id: slaClocks.id });
  const clock = rows[0];
  if (!clock) throw new ApiError('E_UNPROCESSABLE', 'สร้างนาฬิกาไม่สำเร็จ');

  await tx.insert(slaClockEvents).values({
    tenantId,
    clockId: clock.id,
    kind: 'start',
    at,
  });
  return clock;
}

export type PauseKind = 'pause_hours' | 'pause_customer' | 'pause_vendor';

export async function pauseClock(
  tx: Tx,
  taskId: string,
  kind: PauseKind,
  reason: string,
  actorId: string,
) {
  const c = await clockOf(tx, taskId);
  if (c.state !== 'running') throw new ApiError('E_UNPROCESSABLE', 'นาฬิกาไม่ได้เดินอยู่');
  if (!reason.trim()) {
    throw new ApiError('E_REASON_REQUIRED', 'หยุดนาฬิกาต้องบอกเหตุผล — ลูกค้ามีสิทธิ์ถามย้อนหลัง', 'reason');
  }
  await tx.insert(slaClockEvents).values({
    tenantId: c.tenantId,
    clockId: c.id,
    kind,
    reason: reason.trim(),
    actorId,
  });
  await tx.update(slaClocks).set({ state: 'paused' }).where(eq(slaClocks.id, c.id));
}

export async function resumeClock(tx: Tx, taskId: string, actorId: string) {
  const c = await clockOf(tx, taskId);
  if (c.state !== 'paused') throw new ApiError('E_UNPROCESSABLE', 'นาฬิกาไม่ได้หยุดอยู่');
  await tx.insert(slaClockEvents).values({
    tenantId: c.tenantId,
    clockId: c.id,
    kind: 'resume',
    actorId,
  });
  await tx.update(slaClocks).set({ state: 'running' }).where(eq(slaClocks.id, c.id));
}

/** ปิดนาฬิกา — ใช้ตอนคัดแยกว่าไม่ใช่งานประกัน หรือตอนแก้เสร็จ */
export async function stopClock(tx: Tx, taskId: string, actorId: string, reason: string) {
  const c = await clockOf(tx, taskId).catch(() => null);
  if (!c || c.state === 'resolved') return;
  await tx.insert(slaClockEvents).values({
    tenantId: c.tenantId,
    clockId: c.id,
    kind: 'stop',
    reason,
    actorId,
  });
  await tx
    .update(slaClocks)
    .set({ state: 'resolved', resolvedAt: new Date() })
    .where(eq(slaClocks.id, c.id));
}

async function clockOf(tx: Tx, taskId: string) {
  const rows = await tx
    .select({
      id: slaClocks.id,
      tenantId: slaClocks.tenantId,
      state: slaClocks.state,
      targetRespondMinutes: slaClocks.targetRespondMinutes,
      targetResolveMinutes: slaClocks.targetResolveMinutes,
      respondedAt: slaClocks.respondedAt,
      resolvedAt: slaClocks.resolvedAt,
    })
    .from(slaClocks)
    .where(eq(slaClocks.taskId, taskId))
    .limit(1);
  const c = rows[0];
  if (!c) throw new ApiError('E_NOT_FOUND', 'เรื่องนี้ยังไม่มีนาฬิกา SLA');
  return c;
}

export interface ClockStatus {
  clockId: string;
  state: 'running' | 'paused' | 'resolved';
  targetResolveMinutes: number;
  /** เวลาทำการที่ใช้ไปแล้ว — คำนวณสดจากช่วงที่นาฬิกาเดิน */
  usedMinutes: number;
  remainingMinutes: number;
  dueAt: string | null;
  isOverdue: boolean;
  /** เวลาที่หมดไปก่อนคัดแยกเสร็จ — แยกให้เห็นว่าเสียไปกับการตัดสินใจภายในเท่าไร */
  minutesBeforeTriage: number | null;
  segments: { kind: string; at: string; reason: string | null }[];
}

/**
 * คำนวณสถานะนาฬิกาจากเหตุการณ์ทั้งหมด
 *
 * ไล่เป็นช่วงๆ — start กับ resume เปิดช่วง · pause ทุกชนิดและ stop ปิดช่วง
 * ยอดรวมคือผลรวมของทุกช่วงที่เปิด ตัดด้วยเวลาทำการ
 */
export async function clockStatus(tx: Tx, taskId: string): Promise<ClockStatus> {
  const c = await clockOf(tx, taskId);
  const hours = await hoursOf(tx, c.tenantId);

  const events = await tx
    .select({ kind: slaClockEvents.kind, at: slaClockEvents.at, reason: slaClockEvents.reason })
    .from(slaClockEvents)
    .where(eq(slaClockEvents.clockId, c.id))
    .orderBy(asc(slaClockEvents.at));

  let used = 0;
  let openedAt: Date | null = null;
  const now = new Date();

  for (const e of events) {
    if (e.kind === 'start' || e.kind === 'resume') {
      if (!openedAt) openedAt = e.at;
    } else if (openedAt) {
      used += businessMinutesBetween(openedAt, e.at, hours);
      openedAt = null;
    }
  }
  // ยังเดินอยู่ — นับถึงตอนนี้
  if (openedAt && c.state === 'running') used += businessMinutesBetween(openedAt, now, hours);

  const start = events.find((e) => e.kind === 'start')?.at ?? null;
  const dueAt = start ? addBusinessMinutes(start, c.targetResolveMinutes, hours) : null;

  // เวลาที่หมดไปก่อนคัดแยก — อ่านจากเวลาที่ตั้ง warranty_scope ครั้งแรก
  const triaged = await tx.execute<{ at: Date }>(sql`
    select min(e.at) as at from task_events e
    where e.task_id = ${taskId} and e.reason like 'คัดแยก:%'
  `);
  const triagedAt = [...triaged][0]?.at ?? null;
  const beforeTriage =
    start && triagedAt ? businessMinutesBetween(start, new Date(triagedAt), hours) : null;

  return {
    clockId: c.id,
    state: c.state,
    targetResolveMinutes: c.targetResolveMinutes,
    usedMinutes: used,
    remainingMinutes: c.targetResolveMinutes - used,
    dueAt: dueAt ? dueAt.toISOString() : null,
    isOverdue: used > c.targetResolveMinutes,
    minutesBeforeTriage: beforeTriage,
    segments: events.map((e) => ({
      kind: e.kind,
      at: e.at.toISOString(),
      reason: e.reason,
    })),
  };
}

// ─────────────────────────── คัดแยกงานประกัน ───────────────────────────

const SCOPE_LABEL: Record<Exclude<WarrantyScope, 'pending'>, string> = {
  covered: 'อยู่ในประกัน',
  billable: 'นอกประกัน คิดเงินเพิ่ม',
  not_ours: 'ไม่ใช่ปัญหาของเรา',
};

/**
 * เจ้าหน้าที่กดคัดแยกว่าเรื่องนี้อยู่ในประกันหรือไม่
 *
 * คนกดเท่านั้น ไม่มี auto (การตัดสินใจ 20 ส.ค. 2569)
 * `covered` นาฬิกาเดินต่อ · อีกสองแบบปิดนาฬิกา เพราะไม่ได้ผูก SLA แล้ว
 */
export async function triage(
  tx: Tx,
  taskId: string,
  scope: Exclude<WarrantyScope, 'pending'>,
  reason: string,
  actorId: string,
) {
  const rows = await tx
    .select({
      id: tasks.id,
      tenantId: tasks.tenantId,
      origin: tasks.origin,
      warrantyScope: tasks.warrantyScope,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');
  if (t.origin !== 'warranty') {
    throw new ApiError('E_UNPROCESSABLE', 'คัดแยกได้เฉพาะเรื่องที่มาจากช่วงประกัน', 'origin');
  }
  if (scope !== 'covered' && !reason.trim()) {
    throw new ApiError(
      'E_REASON_REQUIRED',
      'บอกลูกค้าว่าทำไมไม่อยู่ในประกัน — เหตุผลนี้จะขึ้นในพอร์ทัล',
      'reason',
    );
  }

  const label = `คัดแยก: ${SCOPE_LABEL[scope]}${reason.trim() ? ` — ${reason.trim()}` : ''}`;
  await tx.update(tasks).set({ warrantyScope: scope }).where(eq(tasks.id, taskId));
  await tx.insert(taskEvents).values({
    tenantId: t.tenantId,
    taskId,
    reason: label,
    actorId,
  });

  // นอกประกันแล้วนาฬิกาไม่ควรเดินต่อ — แต่ไม่ลบ เก็บไว้ดูว่าเสียเวลาไปเท่าไร
  if (scope !== 'covered') await stopClock(tx, taskId, actorId, label);

  return { taskId, warrantyScope: scope, clockStopped: scope !== 'covered' };
}

// ─────────────────────────── ส่งมอบ ───────────────────────────

export interface DeliverInput {
  /** วันสิ้นสุดประกัน — ไม่ส่งมาใช้ 90 วันนับจากวันนี้ */
  endsOn?: string;
  scopeText?: string;
  renewNoticeDays?: number;
}

/**
 * กดส่งมอบ — จุดเปลี่ยนของโปรเจกต์
 *
 * 1. แช่แข็งตัวเลขสุขภาพ ณ วันส่งมอบ (หลังจากนี้การ์ดประกันจะเข้ามาเรื่อยๆ ตัวเลขสดจะเพี้ยน)
 * 2. เข้าเฟส warranty → `portal_enabled` เปิดเอง ตั้งตรงๆ ไม่ได้
 * 3. เปิดสัญญาประกัน + นโยบาย SLA เวอร์ชันแรกถ้ายังไม่มี
 *
 * โควตาปล่อยคืนตรงนี้ — โปรเจกต์ที่ส่งมอบแล้วไม่นับเป็นโปรเจกต์ที่เปิดอยู่
 */
export async function deliverProject(
  tx: Tx,
  tenantId: string,
  projectId: string,
  input: DeliverInput = {},
) {
  const rows = await tx
    .select({
      id: projects.id,
      clientId: projects.clientId,
      deliveredAt: projects.deliveredAt,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');
  if (p.deliveredAt) throw new ApiError('E_CONFLICT', 'โปรเจกต์นี้ส่งมอบไปแล้ว');

  const health = await projectHealth(tx, projectId);
  const now = new Date();

  await tx
    .update(projects)
    .set({ deliveredAt: now, healthSnapshot: health })
    .where(eq(projects.id, projectId));

  // เฟสประกัน — ถ้าโปรเจกต์นี้ยังไม่มี สร้างต่อท้าย
  const warrantyRows = await tx
    .select({ id: projectPhases.id })
    .from(projectPhases)
    .where(and(eq(projectPhases.projectId, projectId), eq(projectPhases.kind, 'warranty')))
    .limit(1);
  let phaseId = warrantyRows[0]?.id;
  if (!phaseId) {
    const [maxPos] = await tx
      .select({ n: sql<number>`coalesce(max(${projectPhases.position}), 0)::int` })
      .from(projectPhases)
      .where(eq(projectPhases.projectId, projectId));
    const made = await tx
      .insert(projectPhases)
      .values({
        tenantId,
        projectId,
        name: 'ประกัน',
        kind: 'warranty',
        position: (maxPos?.n ?? 0) + 1,
      })
      .returning({ id: projectPhases.id });
    phaseId = made[0]?.id;
    if (!phaseId) throw new ApiError('E_UNPROCESSABLE', 'สร้างเฟสประกันไม่สำเร็จ');
  }
  const entered = await enterPhase(tx, projectId, phaseId);

  const startsOn = isoDate(now);
  const endsOn = input.endsOn ?? isoDate(new Date(now.getTime() + 90 * 86_400_000));
  if (endsOn <= startsOn) {
    throw new ApiError('E_INVALID', 'วันสิ้นสุดประกันต้องอยู่หลังวันส่งมอบ', 'endsOn');
  }

  const existing = await tx
    .select({ id: warrantyContracts.id })
    .from(warrantyContracts)
    .where(eq(warrantyContracts.projectId, projectId))
    .limit(1);
  if (!existing[0]) {
    await tx.insert(warrantyContracts).values({
      tenantId,
      clientId: p.clientId,
      projectId,
      startsOn,
      endsOn,
      scopeText: input.scopeText ?? '',
      renewNoticeDays: input.renewNoticeDays ?? 30,
    });
  }

  // มีนโยบายรออยู่ก่อนการ์ดใบแรกเข้ามา จะได้ไม่ต้องสร้างกลางคันตอนลูกค้ากดส่ง
  if (!(await currentPolicy(tx, p.clientId))) {
    await saveContract(tx, tenantId, p.clientId, {});
  }

  return {
    projectId,
    deliveredAt: now.toISOString(),
    healthSnapshot: health,
    portalEnabled: entered.portalEnabled,
    warranty: { startsOn, endsOn },
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────── ศูนย์ SLA ───────────────────────────

export interface SlaRow {
  taskId: string;
  code: string;
  title: string;
  projectId: string;
  projectName: string;
  clientName: string;
  priority: Priority;
  warrantyScope: WarrantyScope;
  portalStage: string | null;
  assigneeId: string | null;
  state: 'running' | 'paused';
  targetResolveMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  /** ยังไม่มีใครกดรับเรื่อง — นาฬิกาเดินอยู่แต่ยังไม่มีใครถือ ต้องขึ้นก่อนเสมอ */
  unclaimed: boolean;
}

/**
 * เรื่องค้างทั้งหมด เรียงตามเวลาที่เหลือ
 *
 * **เรื่องที่ยังไม่มีใครกดรับขึ้นก่อนเสมอ** ต่อให้เวลาเหลือเยอะกว่า
 * เพราะนาฬิกาเดินอยู่แล้วแต่ยังไม่มีเจ้าของ — เป็นความเสี่ยงคนละแบบกับงานที่มีคนทำอยู่
 *
 * กฎข้อ 9: ตัวเลขที่นี่เป็นราย*เรื่อง* ไม่ใช่ราย*คน* เอาไปเรียงลำดับคนไม่ได้
 */
export async function slaOverview(tx: Tx, tenantId: string): Promise<SlaRow[]> {
  const hours = await hoursOf(tx, tenantId);

  const rows = await tx
    .select({
      clockId: slaClocks.id,
      taskId: slaClocks.taskId,
      state: slaClocks.state,
      targetResolveMinutes: slaClocks.targetResolveMinutes,
      number: tasks.number,
      projectKey: projects.key,
      title: tasks.title,
      projectId: tasks.projectId,
      priority: tasks.priority,
      warrantyScope: tasks.warrantyScope,
      portalStage: tasks.portalStage,
      assigneeId: tasks.assigneeId,
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(slaClocks)
    .innerJoin(tasks, eq(tasks.id, slaClocks.taskId))
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(inArray(slaClocks.state, ['running', 'paused']));
  if (rows.length === 0) return [];

  const events = await tx
    .select({ clockId: slaClockEvents.clockId, kind: slaClockEvents.kind, at: slaClockEvents.at })
    .from(slaClockEvents)
    .where(
      inArray(
        slaClockEvents.clockId,
        rows.map((r) => r.clockId),
      ),
    )
    .orderBy(asc(slaClockEvents.at));

  const byClock = new Map<string, { kind: string; at: Date }[]>();
  for (const e of events) {
    const list = byClock.get(e.clockId);
    if (list) list.push(e);
    else byClock.set(e.clockId, [e]);
  }

  const now = new Date();
  const out: SlaRow[] = rows.map((r) => {
    const used = sumOpenSegments(byClock.get(r.clockId) ?? [], r.state === 'running', now, hours);
    return {
      taskId: r.taskId,
      code: `${r.projectKey}-${r.number}`,
      title: r.title,
      projectId: r.projectId,
      projectName: r.projectName,
      clientName: r.clientName,
      priority: r.priority,
      warrantyScope: r.warrantyScope ?? 'pending',
      portalStage: r.portalStage,
      assigneeId: r.assigneeId,
      state: r.state as 'running' | 'paused',
      targetResolveMinutes: r.targetResolveMinutes,
      usedMinutes: used,
      remainingMinutes: r.targetResolveMinutes - used,
      unclaimed: r.portalStage === null,
    };
  });

  out.sort((a, b) => {
    if (a.unclaimed !== b.unclaimed) return a.unclaimed ? -1 : 1;
    return a.remainingMinutes - b.remainingMinutes;
  });
  return out;
}

/** คิวคัดแยก — เรื่องประกันที่ยังไม่มีใครตัดสินว่าอยู่ในประกันหรือไม่ */
export async function triageQueue(tx: Tx) {
  const rows = await tx
    .select({
      taskId: tasks.id,
      number: tasks.number,
      projectKey: projects.key,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      reportedImpact: tasks.reportedImpact,
      portalStage: tasks.portalStage,
      createdAt: tasks.createdAt,
      projectId: tasks.projectId,
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(
      and(
        eq(tasks.origin, 'warranty'),
        or(isNull(tasks.warrantyScope), eq(tasks.warrantyScope, 'pending')),
      ),
    )
    .orderBy(asc(tasks.createdAt));
  return rows.map(({ projectKey, number, ...r }) => ({
    ...r,
    code: `${projectKey}-${number}`,
  }));
}

/** ผลรวมของช่วงที่นาฬิกาเดิน — ใช้ร่วมกันระหว่างหน้ารวมและหน้ารายเรื่อง */
function sumOpenSegments(
  events: { kind: string; at: Date }[],
  stillRunning: boolean,
  now: Date,
  hours: BusinessHours,
): number {
  let used = 0;
  let openedAt: Date | null = null;
  for (const e of events) {
    if (e.kind === 'start' || e.kind === 'resume') {
      if (!openedAt) openedAt = e.at;
    } else if (openedAt) {
      used += businessMinutesBetween(openedAt, e.at, hours);
      openedAt = null;
    }
  }
  if (openedAt && stillRunning) used += businessMinutesBetween(openedAt, now, hours);
  return used;
}

// ─────────────────────────── หน้าสัญญา ───────────────────────────

/** สัญญาประกันที่ยังไม่หมดอายุ + นโยบาย SLA เวอร์ชันปัจจุบันของลูกค้ารายนี้ */
export async function clientContract(tx: Tx, clientId: string) {
  const contracts = await tx
    .select({
      id: warrantyContracts.id,
      projectId: warrantyContracts.projectId,
      projectName: projects.name,
      startsOn: warrantyContracts.startsOn,
      endsOn: warrantyContracts.endsOn,
      scopeText: warrantyContracts.scopeText,
      renewNoticeDays: warrantyContracts.renewNoticeDays,
    })
    .from(warrantyContracts)
    .innerJoin(projects, eq(projects.id, warrantyContracts.projectId))
    .where(eq(warrantyContracts.clientId, clientId))
    .orderBy(desc(warrantyContracts.endsOn));

  const policy = await currentPolicy(tx, clientId);
  const levels = policy ? await policyLevels(tx, policy.id) : [];

  // ประวัติเวอร์ชัน — ให้เห็นว่าเปลี่ยนนโยบายมาแล้วกี่ครั้ง เรื่องเก่ายังใช้ค่าเดิม
  const versions = await tx
    .select({
      id: slaPolicies.id,
      version: slaPolicies.version,
      effectiveFrom: slaPolicies.effectiveFrom,
    })
    .from(slaPolicies)
    .where(eq(slaPolicies.clientId, clientId))
    .orderBy(desc(slaPolicies.version));

  return {
    contracts,
    policy: policy
      ? {
          id: policy.id,
          version: policy.version,
          countBusinessHours: policy.countBusinessHours,
          pauseOnCustomer: policy.pauseOnCustomer,
          pauseOnVendor: policy.pauseOnVendor,
          levels,
        }
      : null,
    versions,
    defaults: DEFAULT_LEVELS,
  };
}
