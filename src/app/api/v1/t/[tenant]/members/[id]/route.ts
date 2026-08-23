import { inTenant, requireOwner } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { type JobTitleValue, type Role, removeMember, setMemberRole } from '@/lib/auth/accounts';

/**
 * PATCH  /api/v1/t/{tenant}/members/{id} — เปลี่ยนบทบาทหรือตำแหน่งงาน · เจ้าของเท่านั้น
 * DELETE /api/v1/t/{tenant}/members/{id} — ถอดออกจากทีม · ถ้ายังเป็น PM ต้องย้ายก่อน
 *
 * ตำแหน่งงาน (jobTitle) ไม่เคยเปลี่ยนสิทธิ์ของใครแม้แต่ครั้งเดียว — ใช้แสดงผลและกรองเท่านั้น
 */
export const dynamic = 'force-dynamic';

type P = { params: Promise<{ tenant: string; id: string }> };

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ role: Role; jobTitle: JobTitleValue }>(req);
    await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      await setMemberRole(tx, ctx.tenantId, id, { role: b.role, jobTitle: b.jobTitle });
    });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      await removeMember(tx, ctx.tenantId, id);
    });
    return ok({ ok: true });
  });
}
