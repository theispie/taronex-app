import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { home } from '@/lib/views';

/** GET — บล็อกของหน้าแรก: รอตัดสินใจ · ต้องรีบ · โปรเจกต์ที่ดูแล */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    return ok(await inTenant(tenant, (tx, ctx) => home(tx, ctx.userId)));
  });
}
