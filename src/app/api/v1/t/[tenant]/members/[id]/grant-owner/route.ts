import { inTenant, requireOwner } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { grantOwner } from '@/lib/auth/accounts';

/** POST — แต่งตั้งเป็นเจ้าของ · ไม่ต้องรอปลายทางกดรับ · เจ้าของหลายคนได้ */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      await grantOwner(tx, ctx.tenantId, id);
    });
    return ok({ ok: true });
  });
}
