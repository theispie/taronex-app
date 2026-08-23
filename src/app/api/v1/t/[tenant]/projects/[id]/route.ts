import { inTenant } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { getProject, updateProject } from '@/lib/projects';

/**
 * GET/PATCH /api/v1/t/{tenant}/projects/{id} — รับทั้ง uuid และรหัส (ACM)
 * สิทธิ์ตัดสินที่ loadProject() ที่เดียวตามกฎข้อ 10
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      const full = await getProject(tx, p.projectId);
      return { ...full, yourAccess: p.access, youArePm: p.isPm };
    });
    return ok(data);
  });
}

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<Record<string, unknown>>(req);
    await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      await updateProject(tx, p.projectId, b);
    });
    return ok({ ok: true });
  });
}
