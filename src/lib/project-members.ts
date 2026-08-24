/**
 * สิทธิ์รายโปรเจกต์และการปิดโปรเจกต์ — M12
 *
 * ═══ กฎข้อ 10 · ตัดสินสิทธิ์ที่เดียว ═══
 * ไฟล์นี้ไม่ตัดสินสิทธิ์เอง มันแค่**แก้ข้อมูลที่ `resolveAccess()` เอาไปใช้**
 * ผลลัพธ์ที่แสดงบนหน้าจอก็คำนวณจาก `resolveAccess()` ตัวเดียวกันเสมอ
 * ถ้าวันหนึ่งกติกาเปลี่ยน ต้องแก้ที่เดียวแล้วทั้งระบบเปลี่ยนตาม รวมถึงตารางบนหน้า 45 ด้วย
 *
 * ═══ ตารางเดียว สองหน้าที่ ═══
 * `project_members` เป็นทั้ง "รายชื่อยกเว้น" ของสมาชิกทั่วไป
 * และ "ใบผ่าน" ของแขกที่ไม่มีสิทธิ์เห็นอะไรเลยถ้าไม่มีแถวนี้
 * ได้สองฟีเจอร์จากตารางเดียว และไม่ต้องมีกติกาสองชุดให้ขัดกันเอง
 *
 * ═══ กฎข้อ 7 ═══
 * `archiveProject()` **ไม่ลบอะไรเลย** ปิดการเข้าถึงฝั่งเขียนกับคืนโควตาเท่านั้น
 * ข้อมูลทั้งหมดยังอยู่ เปิดคืนเมื่อไรก็ได้
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { memberships, projectMembers, projects, tasks, tenants, users } from '@/db/schema';
import { type Access, resolveAccess } from '@/lib/access';
import { ApiError } from '@/lib/api/errors';
import { inviteMember } from '@/lib/auth/accounts';
import { planOf } from '@/lib/plans';

export type Override = 'read' | 'write';

/**
 * ตั้งสิทธิ์ในโปรเจกต์ได้เฉพาะ PM ของโปรเจกต์นั้น หรือเจ้าของที่ทำงาน
 *
 * อยู่ที่นี่ไม่ใช่ในไฟล์ route เพราะไฟล์ route ของ Next.js
 * ควร export แค่ตัวจัดการ HTTP เท่านั้น และสามเส้นทางใช้กติกานี้ร่วมกัน
 */
export function requireManager(isPm: boolean, role: string): void {
  if (!isPm && role !== 'owner') {
    throw new ApiError('E_PM_ONLY', 'ตั้งสิทธิ์ได้เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน');
  }
}

export interface ProjectMemberRow {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member' | 'viewer' | 'guest';
  jobTitle: string;
  /** แถวยกเว้นรายคน · ว่าง = ใช้ค่าเริ่มต้นของโปรเจกต์ */
  override: Override | null;
  isPm: boolean;
  /** ผลลัพธ์จริงหลังผ่าน resolveAccess() — นี่คือสิ่งที่หน้า 45 ต้องแสดง */
  effective: Access;
  /** การ์ดที่ถืออยู่ในโปรเจกต์นี้ — รหัส ไม่ใช่จำนวน (กฎข้อ 9) */
  holding: string[];
}

export interface ProjectAccessView {
  projectId: string;
  key: string;
  name: string;
  memberAccess: 'collaborate' | 'read_only';
  pmUserId: string | null;
  isArchived: boolean;
  members: ProjectMemberRow[];
}

/**
 * ทุกคนในที่ทำงาน พร้อมผลลัพธ์สิทธิ์จริงของโปรเจกต์นี้
 *
 * คืนทุกคน ไม่ใช่เฉพาะคนที่มีแถวยกเว้น เพราะคำถามที่หน้านี้ต้องตอบคือ
 * "ใครเข้าถึงโปรเจกต์นี้ได้บ้าง" ไม่ใช่ "ใครถูกตั้งค่าไว้บ้าง"
 * แขกที่ไม่ได้ถูกเชิญจะได้ `effective = 'none'` แล้วตัวเรียกกรองทิ้งได้ถ้าต้องการ
 */
export async function projectAccessView(tx: Tx, projectId: string): Promise<ProjectAccessView> {
  const rows = await tx
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      memberAccess: projects.memberAccess,
      pmUserId: projects.pmUserId,
      isArchived: projects.isArchived,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const people = await tx
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      jobTitle: memberships.jobTitle,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(isNull(memberships.deactivatedAt), eq(users.isActive, true)))
    .orderBy(asc(users.name));

  const overrides = await tx
    .select({ userId: projectMembers.userId, access: projectMembers.access })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  const byUser = new Map(overrides.map((o) => [o.userId, o.access]));

  const held = await tx
    .select({ assigneeId: tasks.assigneeId, number: tasks.number })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.completedAt)));
  const holdingBy = new Map<string, string[]>();
  for (const t of held) {
    if (!t.assigneeId) continue;
    const list = holdingBy.get(t.assigneeId);
    const code = `${p.key}-${t.number}`;
    if (list) list.push(code);
    else holdingBy.set(t.assigneeId, [code]);
  }

  const projectAccess = p.memberAccess === 'read_only' ? 'read_only' : 'collaborate';

  return {
    projectId: p.id,
    key: p.key,
    name: p.name,
    memberAccess: projectAccess,
    pmUserId: p.pmUserId,
    isArchived: p.isArchived,
    members: people.map((m) => {
      const raw = byUser.get(m.userId);
      const override = raw === 'read' || raw === 'write' ? raw : null;
      return {
        ...m,
        override,
        isPm: p.pmUserId === m.userId,
        effective: resolveAccess({
          role: m.role,
          projectAccess,
          override: override ?? undefined,
          isPm: p.pmUserId === m.userId,
        }),
        holding: holdingBy.get(m.userId) ?? [],
      };
    }),
  };
}

/**
 * เพิ่มคนเข้ารายชื่อยกเว้น — หรือเชิญคนนอกเข้ามาเป็นแขกของโปรเจกต์นี้
 *
 * รับได้ทั้ง `userId` (คนที่อยู่ในที่ทำงานแล้ว) และ `email` (คนนอก)
 * ทางอีเมลจะออกคำเชิญบทบาท `guest` ให้ **แต่ยังไม่มีแถวยกเว้น**
 * จนกว่าเขาจะกดรับคำเชิญ เพราะยังไม่มี `user_id` ให้อ้าง
 */
export async function addProjectMember(
  tx: Tx,
  tenantId: string,
  projectId: string,
  actorId: string,
  input: { userId?: string; email?: string; access: Override },
): Promise<{ userId: string | null; inviteToken: string | null }> {
  if (input.access !== 'read' && input.access !== 'write') {
    throw new ApiError('E_INVALID', 'สิทธิ์รายคนมีได้แค่ ดูอย่างเดียว หรือ ร่วมงานได้', 'access');
  }

  if (input.userId) {
    const member = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, input.userId), isNull(memberships.deactivatedAt)))
      .limit(1);
    // RLS จำกัดอยู่ที่ที่ทำงานนี้แล้ว ไม่พบแปลว่าไม่ได้อยู่ที่นี่
    if (!member[0]) throw new ApiError('E_NOT_FOUND', 'ไม่พบคนนี้ในที่ทำงาน', 'userId');

    await tx
      .insert(projectMembers)
      .values({ tenantId, projectId, userId: input.userId, access: input.access, addedBy: actorId })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { access: input.access, addedBy: actorId },
      });
    return { userId: input.userId, inviteToken: null };
  }

  if (!input.email?.trim()) {
    throw new ApiError('E_INVALID', 'ต้องระบุคนหรืออีเมล', 'email');
  }

  const token = await inviteMember(tx, tenantId, actorId, {
    email: input.email,
    role: 'guest',
    jobTitle: 'other',
  });
  return { userId: null, inviteToken: token };
}

export async function setProjectMemberAccess(
  tx: Tx,
  projectId: string,
  userId: string,
  access: Override,
): Promise<void> {
  if (access !== 'read' && access !== 'write') {
    throw new ApiError('E_INVALID', 'สิทธิ์รายคนมีได้แค่ ดูอย่างเดียว หรือ ร่วมงานได้', 'access');
  }
  const done = await tx
    .update(projectMembers)
    .set({ access })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning({ id: projectMembers.id });
  if (!done[0]) throw new ApiError('E_NOT_FOUND', 'คนนี้ไม่มีแถวยกเว้นในโปรเจกต์นี้');
}

/**
 * ถอดออกจากรายชื่อยกเว้น
 *
 * ลบได้เพราะเป็น**การตั้งค่า** ไม่ใช่ข้อมูลของผู้ใช้ (กฎข้อ 7 ไม่เกี่ยว)
 * สมาชิกทั่วไปจะกลับไปใช้ค่าเริ่มต้นของโปรเจกต์ · แขกจะไม่เห็นโปรเจกต์นี้อีก
 *
 * PM ถอดตัวเองไม่ได้ — PM ไม่ได้รับสิทธิ์จากตารางนี้อยู่แล้ว การถอดจึงหลอกว่าทำอะไรได้
 */
export async function removeProjectMember(
  tx: Tx,
  projectId: string,
  userId: string,
): Promise<void> {
  const p = await tx
    .select({ pmUserId: projects.pmUserId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (p[0]?.pmUserId === userId) {
    throw new ApiError('E_STILL_PM', 'คนนี้เป็น PM ของโปรเจกต์ ย้าย PM ก่อนจึงจะถอดได้');
  }
  await tx
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

/**
 * ค่าเริ่มต้นระดับโปรเจกต์
 *
 * "ดูอย่างเดียว" เป็นประตูฝั่ง**เขียน** ไม่ใช่ฝั่งอ่าน — ไม่ได้ซ่อนอะไรจากใคร
 * ถ้าอยากซ่อนจริง ต้องใช้บทบาทแขกกับรายชื่อยกเว้น ซึ่งเป็นคนละกลไก
 */
export async function setProjectAccess(
  tx: Tx,
  projectId: string,
  memberAccess: 'collaborate' | 'read_only',
): Promise<void> {
  if (memberAccess !== 'collaborate' && memberAccess !== 'read_only') {
    throw new ApiError('E_INVALID', 'ค่าเริ่มต้นมีได้แค่ ร่วมงานได้ หรือ ดูอย่างเดียว', 'memberAccess');
  }
  const done = await tx
    .update(projects)
    .set({ memberAccess })
    .where(eq(projects.id, projectId))
    .returning({ id: projects.id });
  if (!done[0]) throw new ApiError('E_NOT_FOUND');
}

// ─────────────────────────── ปิดและเปิดคืน ───────────────────────────

/**
 * ปิดโปรเจกต์ — **คืนโควตาทันทีโดยไม่ลบอะไรเลย** (กฎข้อ 7)
 *
 * โควตานับเฉพาะโปรเจกต์ที่ `is_archived = false`
 * การ์ด ไฟล์ ประวัติ นาฬิกา SLA ทั้งหมดยังอยู่ครบ เปิดคืนเมื่อไรก็ได้
 * นี่คือเหตุผลที่ทั้งระบบไม่มีเส้นทางลบโปรเจกต์เลยแม้แต่เส้นเดียว
 */
export async function archiveProject(
  tx: Tx,
  tenantId: string,
  projectId: string,
  archived: boolean,
): Promise<{ projectId: string; isArchived: boolean; openProjects: number; limit: number }> {
  const rows = await tx
    .select({ id: projects.id, isArchived: projects.isArchived })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  // ⚠ ต้องมี WHERE เสมอ — `tenants` เป็นตารางเดียวที่**ไม่มี RLS**
  // เคยเขียนเป็น `.limit(1)` เฉยๆ แล้วได้แผนของที่ทำงานอื่นมาใช้จริง
  // เทสต์จับไม่ได้เพราะฐานทดสอบมีที่ทำงานเดียว — เจอตอนยิง HTTP จริง
  const plans = await tx
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const limit = planOf(plans[0]?.plan ?? 'free').projects;

  const open = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.isArchived, false));
  const openNow = open.length;

  // เปิดคืนแล้วเกินโควตาไม่ได้ — ปิดได้เสมอ
  if (p.isArchived && !archived && openNow >= limit) {
    throw new ApiError(
      'E_QUOTA_EXCEEDED',
      `แผนนี้เปิดได้ ${limit} โปรเจกต์ · ปิดโปรเจกต์อื่นก่อนหรืออัปเกรดแผน`,
    );
  }
  if (p.isArchived === archived) {
    return {
      projectId,
      isArchived: archived,
      openProjects: openNow,
      limit,
    };
  }

  await tx.update(projects).set({ isArchived: archived }).where(eq(projects.id, projectId));
  return {
    projectId,
    isArchived: archived,
    openProjects: archived ? openNow - 1 : openNow + 1,
    limit,
  };
}
