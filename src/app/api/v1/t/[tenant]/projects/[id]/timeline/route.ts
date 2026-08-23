import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { projectTimeline } from '@/lib/projects';

/**
 * GET — Timeline ตามงานหลัก · แท่งคำนวณสดจากการ์ดลูก
 *
 * ไม่มีเส้นทาง .png/.pdf ตามที่เอกสารเดิมเขียนไว้
 * เพราะแปลงฝั่งเซิร์ฟเวอร์ด้วย resvg กิน RAM 200–400 MB ต่อครั้ง
 * ซึ่งเครื่อง 1 GB รับไม่ไหวถ้ามีคนกดพร้อมกันสองคน
 * หน้าจอใช้ @media print แทน — เบราว์เซอร์บันทึกเป็น PDF ได้เอง
 * ใช้ RAM ของเซิร์ฟเวอร์เป็นศูนย์
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return projectTimeline(tx, p.projectId);
    });
    return ok(data);
  });
}
