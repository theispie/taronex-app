import { inTenant } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import {
  addProjectMember,
  type Override,
  projectAccessView,
  requireManager,
} from '@/lib/project-members';

/**
 * GET  — ทุกคนในที่ทำงาน พร้อม**ผลลัพธ์สิทธิ์จริง**ของโปรเจกต์นี้
 * POST — { userId | email, access } · เพิ่มรายชื่อยกเว้น หรือเชิญแขกเข้าโปรเจกต์
 *
 * ═══ กฎข้อ 10 ═══
 * ช่อง `effective` ที่คืนออกไปมาจาก `resolveAccess()` ตัวเดียวกับที่ทุก route ใช้
 * หน้าเว็บ**ห้ามคำนวณเอง** ไม่งั้นตารางบนหน้าจะโกหกเมื่อกติกาเปลี่ยน
 *
 * PM เชิญแขกเข้าโปรเจกต์ของตัวเองได้ ไม่ต้องรบกวนเจ้าของที่ทำงาน
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return projectAccessView(tx, p.projectId);
    });
    return ok(data);
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ userId?: string; email?: string; access?: Override }>(req);

    const result = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireManager(p.isPm, ctx.role);
      return addProjectMember(tx, ctx.tenantId, p.projectId, ctx.userId, {
        userId: b.userId,
        email: b.email,
        access: b.access ?? 'write',
      });
    });
    // ยังไม่มี Resend — โทเคนคำเชิญไม่ส่งกลับใน response เด็ดขาด
    return ok({ userId: result.userId, invited: result.inviteToken !== null });
  });
}
