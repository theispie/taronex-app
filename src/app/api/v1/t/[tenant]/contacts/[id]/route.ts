import { inTenant, requireWriter } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { removeContact } from '@/lib/projects';

/**
 * DELETE /api/v1/t/{tenant}/contacts/{id} — เพิกถอนสิทธิ์เข้าพอร์ทัล
 * เรื่องที่เขาเคยแจ้งยังอยู่ครบ แค่ไม่มีคนแจ้งผูกอยู่แล้ว
 */
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, (tx, ctx) => {
      requireWriter(ctx);
      return removeContact(tx, id);
    });
    return ok({ ok: true });
  });
}
