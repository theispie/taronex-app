import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { triage, type WarrantyScope } from '@/lib/sla';

/**
 * POST — คัดแยกงานประกัน { scope, reason? }
 *
 * คนกดเท่านั้น ไม่มี auto — ระบบไม่เดาให้ว่าเรื่องไหนอยู่ในประกัน
 * covered นาฬิกาเดินต่อ · billable/not_ours ปิดนาฬิกาและต้องบอกเหตุผล
 */
export const dynamic = 'force-dynamic';

const SCOPES: Exclude<WarrantyScope, 'pending'>[] = ['covered', 'billable', 'not_ours'];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ scope: string; reason?: string }>(req);
    const scope = str(b.scope, 'scope') as Exclude<WarrantyScope, 'pending'>;
    if (!SCOPES.includes(scope)) throw new ApiError('E_INVALID', 'ผลคัดแยกไม่ถูกต้อง', 'scope');

    const data = await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      const t = rows[0];
      if (!t) throw new ApiError('E_NOT_FOUND');
      const p = await loadProject(tx, ctx, t.projectId);
      requireProjectWrite(p);

      return triage(tx, id, scope, b.reason ?? '', ctx.userId);
    });
    return ok(data);
  });
}
