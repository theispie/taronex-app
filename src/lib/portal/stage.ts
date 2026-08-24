/**
 * ⭐ ประตูเดียวที่สถานะฝั่งลูกค้าเปลี่ยน (`tasks.portal_stage`)
 *
 * ═══ ไม่มี auto — ตัดสิน 20 ส.ค. 2569 ═══
 * "จะต้องไม่เอาข้อมูลอัตโนมัติมาแสดง จะต้องได้รับการกด หรือกรอกจากคนที่มีหน้าที่ก่อน
 *  เท่านั้น ไม่มี auto"
 *
 * แปลว่าไม่มีที่ไหนในระบบแปลงคอลัมน์บนบอร์ดเป็นสถานะพอร์ทัลให้เอง
 * ย้ายการ์ดไป "กำลังทำ" แล้วลูกค้า**ไม่เห็นอะไรเปลี่ยน**จนกว่าจะมีคนกดที่นี่
 * นี่คือของแลก: ทีมต้องกดเพิ่มหนึ่งครั้ง แลกกับสิ่งที่ลูกค้าเห็นเป็นคำที่มีคนรับผิดชอบ
 *
 * ผลพลอยได้ที่สำคัญ — สถานะพอร์ทัลจึงหลุดจากบอร์ดโดยสิ้นเชิง
 * ทีมเปลี่ยนคอลัมน์บนบอร์ดกี่ครั้งก็ได้โดยไม่กระทบสิ่งที่ลูกค้าเห็น (กฎข้อ 8)
 *
 * ═══ ต้องเรียกใน withPortalStageChange() เท่านั้น ═══
 * trigger `guard_portal_stage` ปฏิเสธ UPDATE จากธุรกรรมอื่นที่ชั้นฐานข้อมูล
 */

import { eq } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { projects, taskEvents, tasks } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { PORTAL_STAGES, type PortalStageKey } from './serializer';

const ORDER: PortalStageKey[] = PORTAL_STAGES.map((s) => s.key);

export interface StageResult {
  taskId: string;
  stage: PortalStageKey;
  assignedTo: string | null;
  /** ถอยขั้นได้ แต่บันทึกไว้ว่าถอย — ลูกค้าเห็นวันที่ของขั้นแรกที่กดเสมอ */
  wentBackwards: boolean;
}

export async function setPortalStage(
  tx: Tx,
  taskId: string,
  stage: PortalStageKey,
  actor: { userId: string; isPm: boolean },
  note?: string,
): Promise<StageResult> {
  if (!ORDER.includes(stage)) throw new ApiError('E_INVALID', 'สถานะไม่ถูกต้อง', 'stage');

  const rows = await tx
    .select({
      id: tasks.id,
      tenantId: tasks.tenantId,
      projectId: tasks.projectId,
      origin: tasks.origin,
      assigneeId: tasks.assigneeId,
      current: tasks.portalStage,
    })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');
  if (t.origin !== 'warranty') {
    throw new ApiError('E_UNPROCESSABLE', 'การ์ดนี้ไม่ได้มาจากพอร์ทัลลูกค้า', 'stage');
  }

  // "แก้ไขแล้ว" คือคำสัญญากับลูกค้า — คนเดียวที่ให้ได้คือ PM ของโปรเจกต์
  if (stage === 'resolved' && !actor.isPm) {
    throw new ApiError('E_PM_ONLY', 'บอกลูกค้าว่าแก้ไขแล้วได้เฉพาะ PM ของโปรเจกต์');
  }
  if (t.current === stage) {
    throw new ApiError('E_CONFLICT', 'สถานะนี้ถูกกดไปแล้ว');
  }

  const from = t.current ? ORDER.indexOf(t.current as PortalStageKey) : -1;
  const to = ORDER.indexOf(stage);
  const wentBackwards = from >= 0 && to < from;
  if (wentBackwards && !note?.trim()) {
    throw new ApiError(
      'E_REASON_REQUIRED',
      'ถอยสถานะที่บอกลูกค้าไปแล้วต้องบอกเหตุผล — ลูกค้าเห็นการเปลี่ยนแปลงนี้',
      'note',
    );
  }

  const now = new Date();
  // กด "รับเรื่อง" แล้วรับเป็นเจ้าของถ้ายังไม่มีใครถือ — ไม่แย่งของคนอื่น
  const takeOwnership = stage === 'received' && t.assigneeId === null;

  await tx
    .update(tasks)
    .set({
      portalStage: stage,
      portalStageAt: now,
      portalStageBy: actor.userId,
      ...(takeOwnership ? { assigneeId: actor.userId } : {}),
    })
    .where(eq(tasks.id, taskId));

  // กฎข้อ 5 — ได้ประวัติว่าใครบอกลูกค้าอะไรเมื่อไร
  await tx.insert(taskEvents).values({
    tenantId: t.tenantId,
    taskId,
    fromPortalStage: (t.current as PortalStageKey | null) ?? null,
    toPortalStage: stage,
    toUserId: takeOwnership ? actor.userId : null,
    reason: note?.trim() || null,
    actorId: actor.userId,
    at: now,
  });

  return {
    taskId,
    stage,
    assignedTo: takeOwnership ? actor.userId : t.assigneeId,
    wentBackwards,
  };
}

/** ใครเป็น PM ของโปรเจกต์ที่การ์ดใบนี้อยู่ */
export async function pmOfTask(tx: Tx, taskId: string): Promise<string | null> {
  const rows = await tx
    .select({ pm: projects.pmUserId })
    .from(projects)
    .innerJoin(tasks, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return rows[0]?.pm ?? null;
}
