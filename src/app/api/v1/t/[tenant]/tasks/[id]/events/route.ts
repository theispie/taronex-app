import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { taskHistory } from '@/lib/tasks';

/**
 * GET — ประวัติการ์ดทั้งหมด
 * อ่านอย่างเดียวเสมอ · role app ถูก REVOKE UPDATE/DELETE บนตารางนี้ (กฎข้อ 5)
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      const t = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!t[0]) throw new ApiError('E_NOT_FOUND');
      await loadProject(tx, ctx, t[0].projectId);
      return taskHistory(tx, id);
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}
