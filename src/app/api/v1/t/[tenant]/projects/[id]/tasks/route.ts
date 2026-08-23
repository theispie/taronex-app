import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { type CreateTaskInput, createTask, listTasks } from '@/lib/tasks';

/**
 * GET  ?feature=&column=&assignee=&type=&origin=&unplanned=1
 * POST — สร้างการ์ด · **ลงคอลัมน์แรกเสมอ ไม่รับพารามิเตอร์คอลัมน์** (กฎข้อ 8)
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

export async function GET(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const q = new URL(req.url).searchParams;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return listTasks(tx, p.projectId, {
        featureId: q.get('feature') ?? undefined,
        columnKey: q.get('column') ?? undefined,
        assigneeId: q.get('assignee') ?? undefined,
        typeSlot: (q.get('type') as 'a' | 'b' | 'c' | null) ?? undefined,
        origin: (q.get('origin') as 'delivery' | 'warranty' | null) ?? undefined,
        unplanned: q.get('unplanned') === '1',
      });
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<CreateTaskInput & { title: string }>(req);
    const created = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      return createTask(tx, ctx.tenantId, p.projectId, ctx.userId, {
        ...b,
        title: str(b.title, 'title'),
      });
    });
    return ok(created);
  });
}
