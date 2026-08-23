import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { calendar } from '@/lib/views';

/** GET ?from=&to=&project= — การ์ดที่มีกำหนดส่งในช่วงนั้น จัดกลุ่มตามวัน */
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
    const rows = await inTenant(tenant, (tx) =>
      calendar(tx, from, to, q.get('project') ?? undefined),
    );
    return ok(rows, { page: 1, total: rows.length });
  });
}
