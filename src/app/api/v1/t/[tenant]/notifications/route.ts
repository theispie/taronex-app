import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { listNotifications } from '@/lib/views';

/** GET ?unread=1 — การแจ้งเตือนของคนที่ล็อกอินอยู่เท่านั้น */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const unread = new URL(req.url).searchParams.get('unread') === '1';
    const rows = await inTenant(tenant, (tx, ctx) => listNotifications(tx, ctx.userId, unread));
    return ok(rows, { page: 1, total: rows.length });
  });
}
