import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { clockStatus, resumeClock } from '@/lib/sla';

/** POST — เดินนาฬิกาต่อ · ยอดรวมคำนวณสดจากช่วงทั้งหมด ไม่มีตัวเลขสะสมให้แก้ */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; taskId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, taskId } = await params;
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

      await resumeClock(tx, taskId, ctx.userId);
      return clockStatus(tx, taskId);
    });
    return ok(data);
  });
}
