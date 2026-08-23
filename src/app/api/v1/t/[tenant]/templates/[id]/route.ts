import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { deleteTemplate, getTemplate, updateTemplate } from '@/lib/templates';

/**
 * GET/PATCH/DELETE — แม่แบบหนึ่งชุด
 * แม่แบบกลาง (tenant_id = NULL) อ่านได้ทุกที่ทำงาน แต่แก้ไม่ได้
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    return ok(await inTenant(tenant, (tx) => getTemplate(tx, id)));
  });
}

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ name: string; description: string; definition: unknown }>(req);
    await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return updateTemplate(tx, ctx.tenantId, id, b);
    });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return deleteTemplate(tx, ctx.tenantId, id);
    });
    return ok({ ok: true });
  });
}
