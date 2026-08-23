import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { addFeature, listFeatures } from '@/lib/projects';

/**
 * GET/POST — งานหลักไม่มีคอลัมน์วันที่โดยตั้งใจ
 * ช่วงงานคำนวณสดจากการ์ดลูก ถ้าเก็บวันที่ไว้เองวันหนึ่งจะไม่ตรงกับการ์ดจริง
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return listFeatures(tx, p.projectId);
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ name: string; color: string }>(req);
    const created = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      return addFeature(tx, ctx.tenantId, p.projectId, {
        name: str(b.name, 'name'),
        color: b.color,
      });
    });
    return ok(created);
  });
}
