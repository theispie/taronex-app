import { withAccount, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { listWorkspaces } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/**
 * GET /api/v1/auth/me — ข้อมูลผู้ใช้ + ที่ทำงานที่เข้าได้
 *
 * อยู่ในขอบเขตบัญชี ไม่ใช่ขอบเขตที่ทำงาน จึงใช้ withAccount (กฎข้อ 11)
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) return fail(new ApiError('E_UNAUTHENTICATED'));

    const workspaces = await withAccount(user.userId, user.email, (tx) =>
      listWorkspaces(tx, user.userId),
    );
    return ok({ user, workspaces });
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}
