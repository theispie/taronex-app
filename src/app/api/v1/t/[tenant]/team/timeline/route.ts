import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { teamRange } from '@/lib/views';

/**
 * GET ?from=&to= — โหมด "ช่วงเวลา" · ใครถูกจองช่วงไหน
 *
 * ย้อนหลังอ่านจาก task_events ไม่ใช่จาก tasks.assignee_id ซึ่งเป็นค่าปัจจุบัน
 * ทำได้เพราะทุกการย้ายเขียนเหตุการณ์หนึ่งแถวพร้อม to_user_id เสมอ
 */
export const dynamic = 'force-dynamic';

const isDate = (v: string | null): v is string => Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v));

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const q = new URL(req.url).searchParams;
    const from = q.get('from');
    const to = q.get('to');
    if (!isDate(from) || !isDate(to)) {
      throw new ApiError('E_INVALID', 'ต้องระบุ from และ to เป็นวันที่ YYYY-MM-DD', 'from');
    }
    // จำกัดช่วงไม่ให้ query บานปลายบนเครื่อง 1 GB
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (days < 0 || days > 92) {
      throw new ApiError('E_INVALID', 'ช่วงเวลาต้องไม่เกิน 92 วัน', 'to');
    }
    const rows = await inTenant(tenant, (tx) => teamRange(tx, from, to));
    return ok(rows, { page: 1, total: rows.length });
  });
}
