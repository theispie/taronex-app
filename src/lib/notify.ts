/**
 * แจ้งเตือน — เขียนลงตาราง แล้วส่งอีเมลถ้าเข้าเงื่อนไข
 *
 * ═══ ตารางมาก่อน อีเมลมาทีหลัง ═══
 * แถวใน `notifications` คือความจริง อีเมลเป็นแค่การเอาไปบอก
 * ถ้าส่งอีเมลไม่ออก แถวยังต้องอยู่ — ผู้ใช้จะเห็นในศูนย์แจ้งเตือนเมื่อเปิดเข้ามา
 * สลับลำดับเมื่อไหร่ อีเมลล่มจะกลายเป็น "ไม่มีใครรู้ว่ามีงานเข้า" ทันที
 *
 * ═══ ⚠ ห้ามให้การแจ้งเตือนล้มพางานหลักล้ม ═══
 * ฟังก์ชันในไฟล์นี้ถูกเรียก**ในธุรกรรมเดียวกับการย้ายการ์ด**
 * ถ้าโยนข้อผิดพลาดขึ้นไป การย้ายการ์ดจะถูกยกเลิกไปด้วย
 * ซึ่งแย่กว่าไม่ได้แจ้งเตือนมาก · จึงกลืนข้อผิดพลาดทั้งหมดไว้ที่นี่และแค่บันทึกไว้
 *
 * ═══ ส่งอีเมลจริงแค่สามชนิด (สเปคหน้า 35) ═══
 * assigned · rejected · mentioned
 * ที่เหลือขึ้นในระบบอย่างเดียว เพราะอีเมลที่เยอะเกินจะถูกตั้งกฎให้เข้าโฟลเดอร์ทันที
 * แล้วอันที่สำคัญจริงก็จะไม่ถูกอ่านไปด้วย
 */

import { eq, inArray } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { notifications, projects, tasks, users } from '@/db/schema';
import { appUrl, sendEmail } from '@/lib/email/send';
import { assignedMail, mentionedMail, rejectedMail } from '@/lib/email/templates';

export type NotifyKind =
  | 'assigned'
  | 'transferred'
  | 'rejected'
  | 'mentioned'
  | 'sla_warning'
  | 'client_reported';

/** สามชนิดนี้เท่านั้นที่ส่งอีเมล — ที่เหลือขึ้นในระบบอย่างเดียว */
const EMAILED: ReadonlySet<NotifyKind> = new Set(['assigned', 'rejected', 'mentioned']);

interface Ctx {
  tenantId: string;
  taskId: string;
  /** คนที่ทำให้เกิดเหตุการณ์ — ไม่แจ้งเตือนตัวเอง */
  actorId: string;
  recipientId: string | null;
  kind: NotifyKind;
  reason?: string;
  body?: string;
}

/** ข้อมูลประกอบที่อีเมลต้องใช้ · อ่านทีเดียวแล้วส่งต่อ */
async function context(tx: Tx, taskId: string, actorId: string, recipientId: string) {
  const rows = await tx
    .select({
      number: tasks.number,
      title: tasks.title,
      columnKey: tasks.columnKey,
      projectKey: projects.key,
      board: projects.board,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1);
  const t = rows[0];
  if (!t) return null;

  const people = await tx
    .select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive })
    .from(users)
    .where(inArray(users.id, [actorId, recipientId]));

  const actor = people.find((p) => p.id === actorId);
  const to = people.find((p) => p.id === recipientId);
  if (!to?.isActive) return null;

  const board = (t.board as { key: string; name: string }[]) ?? [];
  const code = `${t.projectKey}-${t.number}`;

  return {
    code,
    title: t.title,
    columnName: board.find((c) => c.key === t.columnKey)?.name ?? '',
    actorName: actor?.name ?? 'ทีมงาน',
    to: to.email,
    url: `${appUrl()}/tickets/${code}`,
  };
}

/**
 * บันทึกการแจ้งเตือนหนึ่งรายการ
 *
 * เรียกได้อย่างปลอดภัยเสมอ — ไม่โยนข้อผิดพลาดออกไปไม่ว่ากรณีใด
 * คืน `false` เมื่อไม่ได้บันทึก (ไม่มีผู้รับ · ผู้รับคือคนทำเอง · เกิดข้อผิดพลาด)
 */
export async function notify(tx: Tx, c: Ctx): Promise<boolean> {
  // ไม่แจ้งเตือนตัวเอง — คนที่เพิ่งกดย่อมรู้อยู่แล้วว่าทำอะไรไป
  if (!c.recipientId || c.recipientId === c.actorId) return false;

  try {
    const info = await context(tx, c.taskId, c.actorId, c.recipientId);
    if (!info) return false;

    await tx.insert(notifications).values({
      tenantId: c.tenantId,
      userId: c.recipientId,
      kind: c.kind,
      taskId: c.taskId,
      actorId: c.actorId,
      /**
       * เก็บ `code` ลง payload ด้วย — หน้าศูนย์แจ้งเตือนต้องใช้ทำลิงก์
       * และการ์ดอาจถูกลบไปแล้วตอนที่คนมาเปิดอ่าน (`task_id` เป็น ON DELETE SET NULL)
       */
      payload: { code: info.code, title: info.title },
    });

    if (EMAILED.has(c.kind)) {
      const mail =
        c.kind === 'assigned'
          ? assignedMail({ ...info, url: info.url })
          : c.kind === 'rejected'
            ? rejectedMail({ ...info, reason: c.reason ?? '', url: info.url })
            : mentionedMail({ ...info, body: c.body ?? '', url: info.url });

      // ไม่ await ผลลัพธ์แบบขวางทาง? — await เพราะต้องอยู่ในธุรกรรมเดียวกัน
      // แต่ sendEmail ไม่โยนข้อผิดพลาด และมี timeout 8 วินาทีคุมไว้แล้ว
      await sendEmail({ to: info.to, ...mail });
    }
    return true;
  } catch (e) {
    // ไม่โยนต่อ — การแจ้งเตือนล้มต้องไม่พาการย้ายการ์ดล้มไปด้วย
    console.warn(`[notify] ${c.kind} ล้มเหลว · ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/**
 * หาคนที่ถูกพูดถึงในคอมเมนต์
 *
 * รูปแบบ `@อีเมล` เท่านั้น ไม่ใช่ `@ชื่อ` — ชื่อคนไทยมีช่องว่างและซ้ำกันได้
 * ส่วนอีเมลไม่ซ้ำและตัดคำได้แน่นอน
 * จับเฉพาะคนที่อยู่ในที่ทำงานนี้ (RLS กรองให้แล้ว) จึงพูดถึงคนนอกไม่ได้
 */
export async function findMentioned(tx: Tx, body: string): Promise<string[]> {
  const handles = [...body.matchAll(/@([\w.+-]+@[\w.-]+\.\w+)/g)].map((m) =>
    (m[1] ?? '').toLowerCase(),
  );
  if (handles.length === 0) return [];

  const rows = await tx
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, [...new Set(handles)]));
  return rows.map((r) => r.id);
}
