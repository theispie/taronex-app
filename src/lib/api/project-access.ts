/**
 * กฎข้อ 10 — ตัดสินสิทธิ์ระดับโปรเจกต์ที่เดียว
 *
 * ทุก route ที่แตะโปรเจกต์ต้องผ่านฟังก์ชันนี้ ห้าม route ไหนตรวจสิทธิ์เอง
 * ตรรกะการตัดสินอยู่ที่ `resolveAccess()` ใน src/lib/access.ts ตัวเดียว
 * ไฟล์นี้ทำหน้าที่แค่ "หาข้อมูลมาป้อนให้มัน" ไม่ได้ตัดสินเอง
 *
 * ไม่มีสิทธิ์ = ตอบ 404 ไม่ใช่ 403 เพราะ 403 ยืนยันว่าโปรเจกต์นั้นมีอยู่จริง
 * ซึ่งบอกใบ้ให้คนนอกรู้ว่าที่ทำงานนี้มีโปรเจกต์รหัสอะไรบ้าง
 */

import { and, eq } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { projectMembers, projects } from '@/db/schema';
import { type Access, resolveAccess } from '@/lib/access';
import type { TenantContext } from './context';
import { ApiError } from './errors';

export interface ProjectContext {
  projectId: string;
  key: string;
  name: string;
  pmUserId: string | null;
  isPm: boolean;
  isArchived: boolean;
  access: Access;
}

/**
 * หาโปรเจกต์ด้วย id หรือรหัส (ACM) แล้วตัดสินสิทธิ์
 * รับทั้งสองแบบเพราะหน้าเว็บใช้รหัสใน URL ส่วน API ภายในใช้ id
 */
export async function loadProject(
  tx: Tx,
  ctx: TenantContext,
  idOrKey: string,
): Promise<ProjectContext> {
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);

  const rows = await tx
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      pmUserId: projects.pmUserId,
      memberAccess: projects.memberAccess,
      isArchived: projects.isArchived,
    })
    .from(projects)
    .where(uuidLike ? eq(projects.id, idOrKey) : eq(projects.key, idOrKey))
    .limit(1);

  const p = rows[0];
  // RLS กรองข้ามที่ทำงานให้แล้ว ไม่พบที่นี่แปลว่าไม่มีจริงหรืออยู่คนละที่ทำงาน
  if (!p) throw new ApiError('E_NOT_FOUND');

  const overrideRows = await tx
    .select({ access: projectMembers.access })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, p.id), eq(projectMembers.userId, ctx.userId)))
    .limit(1);

  const raw = overrideRows[0]?.access;
  const access = resolveAccess({
    role: ctx.role,
    // ค่าระดับโปรเจกต์มีได้แค่ collaborate/read_only · ระดับคนมีได้แค่ read/write
    projectAccess: p.memberAccess === 'read_only' ? 'read_only' : 'collaborate',
    override: raw === 'read' || raw === 'write' ? raw : undefined,
    isPm: p.pmUserId === ctx.userId,
  });

  if (access === 'none') throw new ApiError('E_NOT_FOUND');

  return {
    projectId: p.id,
    key: p.key,
    name: p.name,
    pmUserId: p.pmUserId,
    isPm: p.pmUserId === ctx.userId,
    isArchived: p.isArchived,
    access,
  };
}

/** ต้องเขียนได้ · โปรเจกต์ที่ปิดแล้วแก้ไม่ได้ แต่ยังเปิดดูได้เสมอ */
export function requireProjectWrite(p: ProjectContext): void {
  if (p.access !== 'write') throw new ApiError('E_READ_ONLY');
  if (p.isArchived) {
    throw new ApiError('E_UNPROCESSABLE', 'โปรเจกต์นี้ปิดแล้ว เปิดคืนก่อนจึงจะแก้ได้');
  }
}

/**
 * รหัสโปรเจกต์ทั้งหมดที่ผู้ใช้คนนี้เห็น — ใช้กับหน้าที่รวมข้ามโปรเจกต์ (กิจกรรม · ค้นหา)
 *
 * ตัดสินด้วย `resolveAccess()` ตัวเดียวกับ `loadProject()` (กฎข้อ 10)
 * ไม่ได้ตรวจสิทธิ์เองใหม่ — ต่างกันแค่ทำทีเดียวทั้งชุดแทนที่จะทีละใบ
 */
export async function visibleProjectIds(tx: Tx, ctx: TenantContext): Promise<string[]> {
  const rows = await tx
    .select({
      id: projects.id,
      pmUserId: projects.pmUserId,
      memberAccess: projects.memberAccess,
    })
    .from(projects);

  const overrides = await tx
    .select({ projectId: projectMembers.projectId, access: projectMembers.access })
    .from(projectMembers)
    .where(eq(projectMembers.userId, ctx.userId));
  const byProject = new Map(overrides.map((o) => [o.projectId, o.access]));

  return rows
    .filter((p) => {
      const raw = byProject.get(p.id);
      return (
        resolveAccess({
          role: ctx.role,
          projectAccess: p.memberAccess === 'read_only' ? 'read_only' : 'collaborate',
          override: raw === 'read' || raw === 'write' ? raw : undefined,
          isPm: p.pmUserId === ctx.userId,
        }) !== 'none'
      );
    })
    .map((p) => p.id);
}
