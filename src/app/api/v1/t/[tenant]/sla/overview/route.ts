import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { slaOverview } from '@/lib/sla';

/**
 * GET — เรื่องค้างทั้งหมด เรียงตามเวลาที่เหลือ
 *
 * เรื่องที่ยังไม่มีใครกดรับเรื่องขึ้นก่อนเสมอ (`unclaimed`)
 * เพราะนาฬิกาเดินตั้งแต่ลูกค้ากดส่ง แต่ยังไม่มีใครถือการ์ดใบนั้น
 *
 * กฎข้อ 9 — ตัวเลขเป็นราย*เรื่อง* ไม่ใช่ราย*คน*
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const rows = await inTenant(tenant, (tx, ctx) => slaOverview(tx, ctx.tenantId));
    return ok(rows, { page: 1, total: rows.length });
  });
}
