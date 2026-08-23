import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { addPhase, listPhases } from '@/lib/projects';

/** GET/POST — เฟสคือวงจรชีวิตของโปรเจกต์ คนละเรื่องกับคอลัมน์ของการ์ด */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return listPhases(tx, p.projectId);
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{
      name: string;
      kind: 'normal' | 'delivery' | 'warranty';
      description: string;
    }>(req);
    const created = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      return addPhase(tx, ctx.tenantId, p.projectId, {
        name: str(b.name, 'name'),
        kind: b.kind,
        description: b.description,
      });
    });
    return ok(created);
  });
}
