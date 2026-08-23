import { inTenant } from '@/lib/api/context';
import { body, handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { templateFromProject } from '@/lib/templates';

/**
 * POST — ถอดโปรเจกต์เป็นแม่แบบ
 * ตัดชื่อคน วันจริง และไฟล์ออกทั้งหมด เก็บวันเป็นวันสัมพัทธ์จากวันเริ่ม
 * ไม่งั้นโปรเจกต์ใหม่จะได้กำหนดส่งของโปรเจกต์เก่า และมอบหมายให้คนที่ลาออกไปแล้ว
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; projectId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, projectId } = await params;
    const b = await body<{ name: string }>(req);
    const created = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, projectId);
      return templateFromProject(tx, ctx.tenantId, p.projectId, b.name ?? '');
    });
    return ok(created);
  });
}
