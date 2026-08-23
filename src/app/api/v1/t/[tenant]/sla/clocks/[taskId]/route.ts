import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { clockStatus } from '@/lib/sla';

/**
 * GET — บันทึกช่วงเดินและหยุดทั้งหมดของนาฬิกาเรือนนี้
 *
 * ช่วงแรกคือ ลูกค้ากดส่ง → มีคนกดรับเรื่อง ช่วงนี้ยังไม่มีเจ้าของการ์ด
 * `minutesBeforeTriage` บอกว่าหมดไปกับการตัดสินใจภายในเท่าไร
 */
export const dynamic = 'force-dynamic';

export async function GET(
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
      await loadProject(tx, ctx, t.projectId);
      return clockStatus(tx, taskId);
    });
    return ok(data);
  });
}
