import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { teamNow } from '@/lib/views';

/**
 * GET — โหมด "ตอนนี้" · ใครถืออะไรอยู่
 *
 * กฎข้อ 9 — ตัวเลขในนี้เป็นภาระตอนนี้ ไม่ใช่ผลงานสะสม
 * ไม่มี "ปิดไปกี่ใบ" และจะไม่มี เพราะเป็นตัวเลขที่เอามาเรียงลำดับคนได้ทันที
 * ทุกคนเห็นเหมือนกันหมด ไม่มีตัวเลขลับสำหรับ PM
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const rows = await inTenant(tenant, (tx) => teamNow(tx));
    return ok(rows, { page: 1, total: rows.length });
  });
}
