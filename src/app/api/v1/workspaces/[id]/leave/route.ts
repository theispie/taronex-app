import { withAccount, withoutTenant, withTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { leaveWorkspace, listWorkspaces } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/**
 * POST /api/v1/workspaces/{id}/leave — เจ้าของคนสุดท้ายออกไม่ได้
 * {id} คือรหัสที่ทำงาน (slug) เดียวกับที่อยู่ใน URL ของหน้าเว็บ
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    // ต้องเป็นสมาชิกจริงถึงจะออกได้ · ไม่ใช่สมาชิกตอบไม่พบ
    const mine = await withAccount(user.userId, user.email, (tx) =>
      listWorkspaces(tx, user.userId),
    );
    const target = mine.find((w) => w.slug === id);
    if (!target) throw new ApiError('E_NOT_FOUND');

    await withTenant(target.tenantId, (tx) => leaveWorkspace(tx, target.tenantId, user.userId));
    return ok({ left: target.slug });
  });
}
