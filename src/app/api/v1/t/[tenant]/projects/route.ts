import { inTenant, requireWriter } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createProject, listProjects } from '@/lib/projects';
import { applyTemplate } from '@/lib/templates';

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
      /** ว่างได้ — งานประจำและงานดูแลหลังส่งมอบไม่มีวันจบ */
      dueOn: string | null;
      pmUserId: string;
      board: { key: string; name: string }[];
      typeLabels: Record<string, string>;
      /** ถ้าระบุ จะแตกแม่แบบเป็นแถวจริงในธุรกรรมเดียวกัน */
      templateId: string;
    }>(req);

    const created = await inTenant(tenant, async (tx, ctx) => {
      requireWriter(ctx);
      const project = await createProject(tx, ctx.tenantId, {
        key: str(b.key, 'key'),
        name: str(b.name, 'name'),
        clientId: str(b.clientId, 'clientId'),
        startsOn: str(b.startsOn, 'startsOn'),
        dueOn: typeof b.dueOn === 'string' && b.dueOn.trim() ? b.dueOn : null,
        pmUserId: b.pmUserId ?? null,
        board: b.board,
        typeLabels: b.typeLabels,
      });

      // แม่แบบแตกเป็นแถวจริงในธุรกรรมเดียวกับการสร้างโปรเจกต์
      // ถ้าแตกไม่สำเร็จ โปรเจกต์ต้องไม่ถูกสร้างค้างไว้ครึ่งๆ กลางๆ
      if (b.templateId && project) {
        const applied = await applyTemplate(tx, ctx.tenantId, project.id, b.templateId, ctx.userId);
        return { ...project, applied };
      }
      return project;
    });
    return ok(created);
  });
}
