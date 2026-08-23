import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { type JobTitleValue, updateMembershipProfile } from '@/lib/auth/accounts';

/**
 * PATCH /api/v1/t/{tenant}/me — ตำแหน่งงานของตัวเองในที่ทำงานนี้
 * อยู่ที่ memberships ไม่ใช่ users เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน
 * ชื่อกับรหัสผ่านอยู่ที่ PATCH /account เพราะเป็นข้อมูลของคน ไม่ใช่ของที่ทำงาน
 */
export const dynamic = 'force-dynamic';

const TITLES: JobTitleValue[] = ['pm', 'ba', 'dev', 'qa', 'design', 'other'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ jobTitle: string }>(req);
    if (!(TITLES as string[]).includes(String(b.jobTitle))) {
      throw new ApiError('E_INVALID', 'ตำแหน่งงานไม่ถูกต้อง', 'jobTitle');
    }
    await inTenant(tenant, (tx, ctx) =>
      updateMembershipProfile(tx, ctx.tenantId, ctx.userId, b.jobTitle as JobTitleValue),
    );
    return ok({ ok: true });
  });
}
