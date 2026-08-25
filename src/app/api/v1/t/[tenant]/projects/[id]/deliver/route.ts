import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { type DeliverInput, deliverProject } from '@/lib/sla';

/**
 * POST — กดส่งมอบ · แช่แข็งตัวเลข · เข้าเฟสประกัน · เปิดพอร์ทัล · เริ่มสัญญา
 *
 * กดได้เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน — ย้อนกลับไม่ได้
 * ตัวเลขสุขภาพถูกแช่แข็งลง `health_snapshot` เพราะหลังจากนี้การ์ดประกัน
 * จะไหลเข้ามาเรื่อยๆ แล้วตัวเลขสดจะไม่ตอบคำถามว่า "ตอนส่งมอบเป็นยังไง" อีกต่อไป
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<DeliverInput>(req).catch(() => ({}) as DeliverInput);

    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      if (!p.isPm && ctx.role !== 'owner') {
        throw new ApiError('E_PM_ONLY', 'กดส่งมอบได้เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน');
      }
      return deliverProject(tx, ctx.tenantId, p.projectId, b);
    });
    return ok(data);
  });
}
