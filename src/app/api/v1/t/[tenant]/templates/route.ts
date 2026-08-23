import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createTemplate, listTemplates } from '@/lib/templates';

/**
 * GET  — แม่แบบกลาง + แม่แบบของทีม · ของทีมมาก่อนเสมอ
 * POST — สร้างแม่แบบของทีม
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const rows = await inTenant(tenant, (tx, ctx) => listTemplates(tx, ctx.tenantId));
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ name: string; description: string; definition: unknown }>(req);
    const created = await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return createTemplate(tx, ctx.tenantId, {
        name: str(b.name, 'name'),
        description: b.description,
        definition: b.definition,
      });
    });
    return ok(created);
  });
}
