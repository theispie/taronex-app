import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { addComment } from '@/lib/tasks';

/**
 * POST — บันทึกความคืบหน้า { body }
 *
 * ลงเป็นคอมเมนต์ `is_internal = true` เสมอ **ไม่มีทางเลือกให้ส่งออกฝั่งลูกค้า** (กฎข้อ 6)
 * ถ้าอยากบอกลูกค้า ให้ไปกด `POST /tasks/:id/portal-stage` ซึ่งเป็นคนละการกระทำ
 * และมีคนรับผิดชอบชัดเจนว่าใครเป็นคนบอก
 *
 * เส้นนี้มีอยู่เพื่อให้หน้ากิจกรรมมีอะไรอ่าน โดยไม่ต้องให้ใครกรอกใบรายงานแยก
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ body: string }>(req);
    const text = str(b.body, 'body');

    const created = await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      const t = rows[0];
      if (!t) throw new ApiError('E_NOT_FOUND');
      const p = await loadProject(tx, ctx, t.projectId);
      requireProjectWrite(p);
      return addComment(tx, ctx.tenantId, id, ctx.userId, { body: text, isInternal: true });
    });
    return ok(created);
  });
}
