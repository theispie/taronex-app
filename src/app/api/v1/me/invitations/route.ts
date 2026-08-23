import { withAccount, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { listMyInvitations } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/** GET /api/v1/me/invitations — คำเชิญที่ยังไม่ตอบของอีเมลนี้ (กฎข้อ 11) */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');
    const rows = await withAccount(user.userId, user.email, (tx) =>
      listMyInvitations(tx, user.email),
    );
    return ok(rows, { page: 1, total: rows.length });
  });
}
