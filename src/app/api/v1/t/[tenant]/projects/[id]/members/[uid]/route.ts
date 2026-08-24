import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import {
  type Override,
  removeProjectMember,
  requireManager,
  setProjectMemberAccess,
} from '@/lib/project-members';

/**
 * PATCH  — เปลี่ยนแถวยกเว้นเป็น read หรือ write
 * DELETE — ถอดออกจากรายชื่อยกเว้น
 *
 * DELETE ที่นี่ลบ**การตั้งค่า** ไม่ใช่ข้อมูลของผู้ใช้ — กฎข้อ 7 ไม่เกี่ยว
 * สมาชิกทั่วไปกลับไปใช้ค่าเริ่มต้นของโปรเจกต์ · แขกจะไม่เห็นโปรเจกต์นี้อีก
 */
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string; uid: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id, uid } = await params;
    const b = await body<{ access: string }>(req);
    const access = str(b.access, 'access') as Override;

    await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireManager(p.isPm, ctx.role);
      await setProjectMemberAccess(tx, p.projectId, uid, access);
    });
    return ok({ userId: uid, access });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string; uid: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id, uid } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireManager(p.isPm, ctx.role);
      await removeProjectMember(tx, p.projectId, uid);
    });
    return ok({ userId: uid, removed: true });
  });
}
