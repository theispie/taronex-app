import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { clockStatus, type PauseKind, pauseClock } from '@/lib/sla';

/**
 * POST — หยุดนาฬิกา { kind, reason }
 *
 * ต้องมีเหตุผลเสมอ เพราะลูกค้ามีสิทธิ์ถามย้อนหลังว่าทำไมเวลาถึงหยุด
 * kind: pause_hours (นอกเวลาทำการ) · pause_customer (รอลูกค้า) · pause_vendor (รอผู้ให้บริการอื่น)
 */
export const dynamic = 'force-dynamic';

const KINDS: PauseKind[] = ['pause_hours', 'pause_customer', 'pause_vendor'];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; taskId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, taskId } = await params;
    const b = await body<{ kind: string; reason: string }>(req);
    const kind = str(b.kind, 'kind') as PauseKind;
    if (!KINDS.includes(kind)) throw new ApiError('E_INVALID', 'ชนิดการหยุดไม่ถูกต้อง', 'kind');

    const data = await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);
      const t = rows[0];
      if (!t) throw new ApiError('E_NOT_FOUND');
      const p = await loadProject(tx, ctx, t.projectId);
      requireProjectWrite(p);

      await pauseClock(tx, taskId, kind, b.reason ?? '', ctx.userId);
      return clockStatus(tx, taskId);
    });
    return ok(data);
  });
}
