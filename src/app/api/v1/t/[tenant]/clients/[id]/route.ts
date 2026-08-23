import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { updateClient } from '@/lib/projects';

/** PATCH /api/v1/t/{tenant}/clients/{id} */
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ name: string; code: string; note: string }>(req);
    const r = await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return updateClient(tx, id, b);
    });
    return ok(r);
  });
}
