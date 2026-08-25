/**
 * ตัวเลขประกอบของแต่ละที่ทำงาน สำหรับหน้ากลาง (หน้าจอ 42)
 *
 * ═══ ทำไมต้องนับทีละที่ทำงาน ไม่ใช่ query เดียวรวบ ═══
 * `GET /me/workspaces` ทำงานใน `withAccount()` ซึ่งตั้งแค่ `app.user_id`
 * ไม่ได้ตั้ง `app.tenant_id` — policy ของ `projects` กับ `tasks` ยึด tenant_id
 * ถามในธุรกรรมนั้นจึงได้ **0 แถวเสมอ** ไม่ใช่เพราะไม่มีข้อมูล แต่เพราะ RLS ปิดอยู่
 *
 * ทางลัดที่ผิดคือไปเพิ่ม policy ให้ตารางพวกนี้อ่านข้าม tenant ได้
 * — เท่ากับเจาะกำแพงหลักของระบบเพื่อโชว์ตัวเลขบนหน้าจอเดียว
 * จึงเปิดธุรกรรมแยกต่อหนึ่งที่ทำงานแทน · N เท่ากับจำนวนที่ทำงานที่คนคนนี้อยู่
 * ซึ่งปกติคือ 1–3 และมีเพดานกันไว้ที่ `MAX_WORKSPACES`
 *
 * ═══ กฎข้อ 11 ═══
 * สเปคหน้าจอ 42 เขียนไว้ว่า "ตัวเลขรอคุณเป็นสิ่งเดียวที่ข้ามที่ทำงานได้
 * เพราะเป็นการนับ ไม่ใช่การเอาข้อมูลมาปน" — คืนแค่จำนวน ไม่มีชื่อการ์ดหลุดออกมา
 */

import { and, count, eq, isNull } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { memberships, projectMembers, projects, tasks, users } from '@/db/schema';
import { type MembershipRole, resolveAccess } from '@/lib/access';

/** เพดานกันกรณีสุดโต่ง — คนที่อยู่ 50 ที่ทำงานไม่ควรทำให้หน้านี้ยิง 50 ธุรกรรม */
export const MAX_WORKSPACES = 12;

export interface WorkspaceCounts {
  members: number;
  /** โปรเจกต์ที่คนคนนี้เห็นจริง ไม่ใช่ทั้งหมดในที่ทำงาน (แขกเห็นไม่ครบ) */
  projects: number;
  /** การ์ดที่ถืออยู่และยังไม่ปิด — "รอคุณ" */
  waitingOnYou: number;
}

export async function workspaceCounts(
  tx: Tx,
  userId: string,
  role: MembershipRole,
): Promise<WorkspaceCounts> {
  const [seats] = await tx
    .select({ n: count() })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(isNull(memberships.deactivatedAt), eq(users.isActive, true)));

  const open = await tx
    .select({
      id: projects.id,
      pmUserId: projects.pmUserId,
      memberAccess: projects.memberAccess,
    })
    .from(projects)
    .where(eq(projects.isArchived, false));

  const overrides = await tx
    .select({ projectId: projectMembers.projectId, access: projectMembers.access })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const byProject = new Map(overrides.map((o) => [o.projectId, o.access]));

  // ใช้ resolveAccess() ตัวเดียวกับทุกที่ในระบบ (กฎข้อ 10) ไม่ตัดสินสิทธิ์เองใหม่
  const visible = open.filter((p) => {
    const raw = byProject.get(p.id);
    return (
      resolveAccess({
        role,
        projectAccess: p.memberAccess === 'read_only' ? 'read_only' : 'collaborate',
        override: raw === 'read' || raw === 'write' ? raw : undefined,
        isPm: p.pmUserId === userId,
      }) !== 'none'
    );
  });

  const [waiting] = await tx
    .select({ n: count() })
    .from(tasks)
    .where(and(eq(tasks.assigneeId, userId), isNull(tasks.completedAt)));

  return {
    members: seats?.n ?? 0,
    projects: visible.length,
    waitingOnYou: waiting?.n ?? 0,
  };
}
