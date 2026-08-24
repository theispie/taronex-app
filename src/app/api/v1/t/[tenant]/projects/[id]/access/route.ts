import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { projectAccessView, requireManager, setProjectAccess } from '@/lib/project-members';

/**
 * PATCH — { memberAccess: 'collaborate' | 'read_only' }
 *
 * "ดูอย่างเดียว" เป็นประตูฝั่ง**เขียน** ไม่ใช่ฝั่งอ่าน — ไม่ได้ซ่อนอะไรจากใคร
 * ถ้าอยากซ่อนจริงต้องใช้บทบาทแขกกับรายชื่อยกเว้น ซึ่งเป็นคนละกลไก
 * เขียนไว้ตรงนี้เพราะเป็นจุดที่คนเข้าใจผิดบ่อยที่สุดในโมเดลสิทธิ์ทั้งหมด
 *
 * คืนตารางสิทธิ์ที่คำนวณใหม่ทั้งชุด เพื่อให้หน้าเว็บเห็นผลลัพธ์จริงทันที
 * โดยไม่ต้องคำนวณเอง (กฎข้อ 10)
 */
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ memberAccess: string }>(req);
    const memberAccess = str(b.memberAccess, 'memberAccess') as 'collaborate' | 'read_only';

    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireManager(p.isPm, ctx.role);
      await setProjectAccess(tx, p.projectId, memberAccess);
      return projectAccessView(tx, p.projectId);
    });
    return ok(data);
  });
}
