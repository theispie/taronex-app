import { withAccount, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { listWorkspaces } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/**
 * GET /api/v1/me/workspaces — หนึ่งในสี่เส้นทางที่ query ข้าม tenant ได้ (กฎข้อ 11)
 *
 * กรองด้วย user_id ของ session เท่านั้น ไม่รับพารามิเตอร์ใดๆ ที่เปลี่ยนขอบเขตได้
 * และ RLS ยังบังคับซ้ำอีกชั้นด้วย policy ที่เปิดเฉพาะแถวของคนคนนี้
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await withoutTenant((tx) => currentUser(tx));
  if (!user) return fail(new ApiError('E_UNAUTHENTICATED'));

  const workspaces = await withAccount(user.userId, user.email, (tx) =>
    listWorkspaces(tx, user.userId),
  );
  return ok(workspaces, { page: 1, total: workspaces.length });
}
