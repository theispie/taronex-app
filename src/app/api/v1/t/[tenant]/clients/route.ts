import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createClient, listClients } from '@/lib/projects';

/** GET/POST /api/v1/t/{tenant}/clients */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const rows = await inTenant(tenant, (tx) => listClients(tx));
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ name: string; code: string; note: string }>(req);
    const created = await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return createClient(tx, ctx.tenantId, {
        name: str(b.name, 'name'),
        code: str(b.code, 'code'),
        note: b.note,
      });
    });
    return ok(created);
  });
}
