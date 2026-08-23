import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { search } from '@/lib/views';

/**
 * GET ?q= — ค้นข้ามทุกโปรเจกต์ · รองรับรหัสการ์ด (ACM-138)
 *
 * ใช้ ILIKE ไม่ใช่ full-text search เพราะภาษาไทยไม่มีเว้นวรรคระหว่างคำ
 * ตัวตัดคำของ Postgres จะมองทั้งประโยคเป็นคำเดียว แล้วค้นคำกลางประโยคไม่เจอ
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const q = new URL(req.url).searchParams.get('q') ?? '';
    const r = await inTenant(tenant, (tx) => search(tx, q));
    return ok(r, { page: 1, total: r.tasks.length });
  });
}
