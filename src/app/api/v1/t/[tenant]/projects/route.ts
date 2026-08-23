import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createProject, listProjects } from '@/lib/projects';

/** GET/POST /api/v1/t/{tenant}/projects · ?archived=1&client=<id> */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string }> };

export async function GET(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const q = new URL(req.url).searchParams;
    const archived = q.get('archived');
    const rows = await inTenant(tenant, (tx) =>
      listProjects(tx, {
        // ไม่ระบุ = เอาเฉพาะที่ยังไม่ปิด · archived=all = เอาทั้งหมด
        archived: archived === 'all' ? undefined : archived === '1',
        clientId: q.get('client') ?? undefined,
      }),
    );
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{
      key: string;
      name: string;
      clientId: string;
      startsOn: string;
      dueOn: string;
      pmUserId: string;
      board: { key: string; name: string }[];
      typeLabels: Record<string, string>;
    }>(req);

    const created = await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return createProject(tx, ctx.tenantId, {
        key: str(b.key, 'key'),
        name: str(b.name, 'name'),
        clientId: str(b.clientId, 'clientId'),
        startsOn: str(b.startsOn, 'startsOn'),
        dueOn: str(b.dueOn, 'dueOn'),
        pmUserId: b.pmUserId ?? null,
        board: b.board,
        typeLabels: b.typeLabels,
      });
    });
    return ok(created);
  });
}
