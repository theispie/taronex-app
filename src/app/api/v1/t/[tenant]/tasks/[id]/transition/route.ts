import { eq } from 'drizzle-orm';
import { withColumnMove } from '@/db/client';
import { tasks } from '@/db/schema';
import { requireTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { transition } from '@/lib/transition';

/**
 * ⭐ POST — ประตูเดียวที่การ์ดขยับคอลัมน์ได้ (กฎข้อ 4)
 *
 * ใช้ withColumnMove() ซึ่งตั้ง app.allow_column_move ให้ trigger ยอมให้แก้ column_key
 * ธุรกรรมอื่นทั้งหมดถูก trigger ปฏิเสธที่ชั้นฐานข้อมูล ไม่ใช่แค่ชั้นแอป
 * ใบอนุญาตเป็น LOCAL จึงหมดอายุพร้อมธุรกรรม ไม่ติดค้างกับ connection
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ toColumnKey: string; reason: string; assigneeId: string | null }>(req);
    const toColumnKey = str(b.toColumnKey, 'toColumnKey');

    const ctx = await requireTenant(tenant);
    const result = await withColumnMove(ctx.tenantId, async (tx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!rows[0]) throw new ApiError('E_NOT_FOUND');

      const p = await loadProject(tx, ctx, rows[0].projectId);
      requireProjectWrite(p);

      return transition(
        tx,
        id,
        { userId: ctx.userId, isPm: p.isPm },
        { toColumnKey, reason: b.reason, assigneeId: b.assigneeId },
      );
    });
    return ok(result);
  });
}
