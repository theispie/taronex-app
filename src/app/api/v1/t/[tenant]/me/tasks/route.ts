import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { myTasks } from '@/lib/views';

/**
 * GET — งานที่ได้รับ จัดกลุ่มตามความเร่งด่วน
 * จัดจาก "อาการ" ไม่ใช่จากค่า priority ที่ตั้งไว้
 * การ์ด critical ที่ยังไม่ถึงกำหนด ไม่ได้เร่งกว่าการ์ดที่เลยกำหนดไปแล้ว
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    return ok(await inTenant(tenant, (tx, ctx) => myTasks(tx, ctx.userId)));
  });
}
