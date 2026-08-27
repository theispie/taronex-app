/**
 * ⭐ เครื่องยนต์เปลี่ยนคอลัมน์ — ประตูเดียวที่การ์ดขยับได้ (กฎข้อ 4)
 *
 * ═══ ทำไมไฟล์นี้สำคัญกว่าไฟล์อื่น ═══
 * ทุกอย่างที่ระบบรู้เกี่ยวกับ "งานไปถึงไหนแล้ว" มาจาก task_events ที่เขียนที่นี่
 * ถือมากี่วัน · ธงค้างนาน · สถิติรอบตีกลับ · ภาพรวมทีมย้อนหลัง · นาฬิกา SLA
 * ถ้าเส้นทางไหนขยับการ์ดได้โดยไม่ผ่านที่นี่ ตัวเลขทั้งหมดจะผิดโดยไม่มีใครรู้
 *
 * ═══ กติกาคำนวณสดจากตำแหน่งและทิศทาง ไม่มีการตั้งค่าใดๆ ในคอลัมน์ (กฎข้อ 8) ═══
 *   คอลัมน์สุดท้าย → ปิดงาน · PM เท่านั้น
 *   ลากถอยหลัง    → ตีกลับ การ์ดกลับไปหาเจ้าของคนก่อน (เหตุผลใส่หรือไม่ใส่ก็ได้)
 *   ที่เหลือ       → ย้ายได้ตามปกติ
 *
 * การตัดสินว่าเป็นทิศทางไหนใช้ checkMove() ใน types.ts ตัวเดียวกับที่หน้าจอใช้
 * เพื่อไม่ให้ฝั่งเซิร์ฟเวอร์กับฝั่งหน้าจอตัดสินไม่ตรงกัน
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { comments, projects, taskEvents, tasks } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { notify } from '@/lib/notify';
import { checkMove } from '@/lib/types';

interface BoardColumn {
  key: string;
  name: string;
}

export interface TransitionInput {
  toColumnKey: string;
  reason?: string;
  /** ระบุผู้รับผิดชอบคนใหม่ตอนย้ายไปข้างหน้า · ตอนตีกลับระบบเลือกให้เอง */
  assigneeId?: string | null;
}

export interface TransitionResult {
  kind: 'forward' | 'backward' | 'close';
  fromColumn: string;
  toColumn: string;
  assigneeId: string | null;
  isClosed: boolean;
}

/**
 * หาเจ้าของคนก่อนหน้าจากประวัติ — ใช้ตอนตีกลับ
 *
 * อ่านจาก task_events ไม่ใช่เก็บคอลัมน์ "เจ้าของคนก่อน" ไว้
 * เพราะการ์ดอาจถูกตีกลับหลายรอบ และเจ้าของคนก่อนของแต่ละรอบไม่เหมือนกัน
 * ประวัติเป็นแหล่งเดียวที่ตอบได้ถูกทุกรอบ
 */
async function previousOwner(tx: Tx, taskId: string, currentAssignee: string | null) {
  const rows = await tx
    .select({ userId: taskEvents.fromUserId })
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), isNotNull(taskEvents.fromUserId)))
    .orderBy(desc(taskEvents.at))
    .limit(5);

  // คนก่อนหน้าที่ไม่ใช่คนที่ถืออยู่ตอนนี้
  for (const r of rows) {
    if (r.userId && r.userId !== currentAssignee) return r.userId;
  }
  return null;
}

export async function transition(
  tx: Tx,
  taskId: string,
  actor: { userId: string; isPm: boolean },
  input: TransitionInput,
): Promise<TransitionResult> {
  const rows = await tx
    .select({
      id: tasks.id,
      tenantId: tasks.tenantId,
      projectId: tasks.projectId,
      columnKey: tasks.columnKey,
      assigneeId: tasks.assigneeId,
      board: projects.board,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1);

  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');

  const board = (t.board as BoardColumn[]) ?? [];
  const from = board.findIndex((c) => c.key === t.columnKey);
  const to = board.findIndex((c) => c.key === input.toColumnKey);

  if (to < 0) {
    throw new ApiError('E_INVALID', `ไม่มีคอลัมน์ ${input.toColumnKey} บนบอร์ดนี้`, 'toColumnKey');
  }
  if (to === from) {
    throw new ApiError('E_UNPROCESSABLE', 'การ์ดอยู่คอลัมน์นี้อยู่แล้ว', 'toColumnKey');
  }

  // ตัวเดียวกับที่หน้าจอใช้ตัดสิน ฝั่งเซิร์ฟเวอร์กับหน้าจอจึงไม่มีทางตัดสินต่างกัน
  const move = checkMove(from < 0 ? 0 : from, to, board.length);

  if (move.pmOnly && !actor.isPm) {
    throw new ApiError('E_PM_ONLY', 'ปิดงานได้เฉพาะ PM ของโปรเจกต์');
  }

  // เหตุผลไม่บังคับแล้ว — ส่งมาก็บันทึก ไม่ส่งก็ย้ายได้ (ดู MoveCheck ใน types.ts)
  const reason = input.reason?.trim() ?? '';

  // ตีกลับ = การ์ดกลับไปหาเจ้าของคนก่อน · ย้ายปกติ = ใช้ค่าที่ส่งมา หรือคงเดิม
  const nextAssignee =
    move.kind === 'backward'
      ? await previousOwner(tx, taskId, t.assigneeId)
      : input.assigneeId !== undefined
        ? input.assigneeId
        : t.assigneeId;

  const fromCol = from >= 0 ? board[from] : undefined;
  const toCol = board[to];
  if (!toCol) throw new ApiError('E_INVALID', 'คอลัมน์ปลายทางไม่ถูกต้อง', 'toColumnKey');

  // การ์ดไปท้ายคอลัมน์ปลายทาง
  const [last] = await tx
    .select({ n: sql<number>`coalesce(max(position), 0)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, t.projectId), eq(tasks.columnKey, toCol.key)));

  await tx
    .update(tasks)
    .set({
      columnKey: toCol.key,
      assigneeId: nextAssignee,
      position: Number(last?.n ?? 0) + 1,
      // ปิดงานแล้วบันทึกเวลา · ย้ายออกจากคอลัมน์สุดท้ายก็ล้างทิ้ง
      completedAt: move.kind === 'close' ? new Date() : null,
      // คำตอบ "จะเสร็จเมื่อไร" ของคอลัมน์เดิมใช้ไม่ได้แล้ว
      eta: null,
      etaUpdatedAt: null,
    })
    .where(eq(tasks.id, taskId));

  /**
   * เขียนประวัติพร้อม **ชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้น**
   * คอลัมน์ลบได้และเปลี่ยนชื่อได้ แต่เหตุการณ์ลบไม่ได้ (กฎข้อ 5)
   * ถ้าเก็บแค่คีย์ วันที่มีคนลบคอลัมน์ ประวัติย้อนหลังทั้งหมดจะชี้ไปที่ของที่ไม่มีแล้ว
   */
  await tx.insert(taskEvents).values({
    tenantId: t.tenantId,
    taskId,
    fromColumnKey: fromCol?.key ?? null,
    toColumnKey: toCol.key,
    fromColumnName: fromCol?.name ?? null,
    toColumnName: toCol.name,
    fromColumnIndex: from >= 0 ? from : null,
    toColumnIndex: to,
    columnCount: board.length,
    fromUserId: t.assigneeId,
    toUserId: nextAssignee,
    reason: reason || null,
    actorId: actor.userId,
  });

  // เหตุผลตีกลับต้องเห็นได้ในหน้าการ์ดด้วย ไม่ใช่ซ่อนอยู่แต่ในประวัติ
  if (move.kind === 'backward' && reason) {
    await tx.insert(comments).values({
      tenantId: t.tenantId,
      taskId,
      authorId: actor.userId,
      body: `ตีกลับ: ${reason}`,
      isInternal: true,
      isSystem: true,
    });
  }

  /**
   * แจ้งเตือนคนที่รับการ์ดไป — เฉพาะเมื่อเปลี่ยนมือจริง
   *
   * ตีกลับกับส่งต่อเป็นคนละเรื่องสำหรับคนรับ
   *   ตีกลับ = ของที่เคยส่งไปแล้วกลับมา ต้องรู้ว่าทำไม
   *   ส่งต่อ = ของใหม่เข้ามา ต้องรู้ว่าอยู่ขั้นไหน
   * `notify()` ไม่โยนข้อผิดพลาดออกมาเลย การย้ายการ์ดจึงไม่มีทางล้มเพราะอีเมล
   */
  if (nextAssignee && nextAssignee !== t.assigneeId) {
    await notify(tx, {
      tenantId: t.tenantId,
      taskId,
      actorId: actor.userId,
      recipientId: nextAssignee,
      kind: move.kind === 'backward' ? 'rejected' : 'assigned',
      reason,
    });
  }

  return {
    kind: move.kind,
    fromColumn: fromCol?.name ?? '',
    toColumn: toCol.name,
    assigneeId: nextAssignee,
    isClosed: move.kind === 'close',
  };
}
