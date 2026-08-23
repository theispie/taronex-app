import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { addContact, listContacts } from '@/lib/projects';

/**
 * GET/POST /api/v1/t/{tenant}/clients/{id}/contacts
 * ผู้ติดต่อของลูกค้าไม่ใช่ users และไม่นับโควตาที่นั่ง
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, (tx) => listContacts(tx, id));
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ name: string; email: string; canReport: boolean; canSeeAll: boolean }>(
      req,
    );
    const created = await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return addContact(tx, ctx.tenantId, id, {
        name: str(b.name, 'name'),
        email: str(b.email, 'email'),
        canReport: b.canReport,
        canSeeAll: b.canSeeAll,
      });
    });
    return ok(created);
  });
}
