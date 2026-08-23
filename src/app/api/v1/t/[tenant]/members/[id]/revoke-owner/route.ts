import { inTenant, requireOwner } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { revokeOwner } from '@/lib/auth/accounts';

/** POST — ถอดจากเจ้าของ · ปฏิเสธถ้าเหลือคนเดียว (กฎข้อ 12) */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      await revokeOwner(tx, ctx.tenantId, id);
    });
    return ok({ ok: true });
  });
}
