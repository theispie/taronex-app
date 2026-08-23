import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { triageQueue } from '@/lib/sla';

/** GET — คิวคัดแยก เรื่องประกันที่ยังไม่มีใครตัดสินว่าอยู่ในประกันหรือไม่ */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const rows = await inTenant(tenant, (tx) => triageQueue(tx));
    return ok(rows, { page: 1, total: rows.length });
  });
}
