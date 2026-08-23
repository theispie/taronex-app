import { inTenant, requireOwner } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { deactivateMember } from '@/lib/auth/accounts';

/**
 * POST — ปิดใช้งาน ไม่ใช่ลบ
 * task_events ต้องชี้ตัวตนเดิมได้เสมอ ประวัติที่เขาทำไว้จึงยังอ่านได้ครบ
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      await deactivateMember(tx, ctx.tenantId, id);
    });
    return ok({ ok: true });
  });
}
