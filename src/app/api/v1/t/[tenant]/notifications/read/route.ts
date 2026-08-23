import { inTenant } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { markNotificationsRead } from '@/lib/views';

/** POST { ids[] } หรือ { all: true } — ทำเครื่องหมายว่าอ่านแล้ว */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ ids: string[]; all: boolean }>(req);
    const n = await inTenant(tenant, (tx, ctx) =>
      markNotificationsRead(tx, ctx.userId, {
        ids: Array.isArray(b.ids) ? b.ids : undefined,
        all: b.all === true,
      }),
    );
    return ok({ marked: n });
  });
}
