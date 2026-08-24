import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { portalIssueDetail } from '@/lib/portal/serializer';

/**
 * GET — ดูอย่างที่ลูกค้าเห็น
 *
 * เรียก `portalIssueDetail()` **ตัวเดียวกับที่พอร์ทัลจริงเรียก** (กฎข้อ 6)
 * ถ้าเขียน serializer ตัวที่สองไว้ตรงนี้ วันหนึ่งสองตัวจะต่างกัน
 * แล้วหน้านี้จะโกหก ซึ่งอันตรายกว่าไม่มีหน้านี้เลย —
 * ทีมจะเชื่อมันแล้วเผลอเขียนอะไรที่ลูกค้าไม่ควรเห็น
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      const t = rows[0];
      if (!t) throw new ApiError('E_NOT_FOUND');
      await loadProject(tx, ctx, t.projectId);

      const detail = await portalIssueDetail(tx, id);
      if (!detail) throw new ApiError('E_NOT_FOUND');
      return detail;
    });
    return ok(data);
  });
}
