import { withAccount, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { acceptInvitation } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/**
 * POST /api/v1/invitations/{token}/accept — หนึ่งในสี่เส้นทางที่ข้าม tenant ได้ (กฎข้อ 11)
 *
 * ═══ ห้ามสร้าง tenants ที่นี่ ═══
 * เส้นทางนี้หน้าตาคล้ายการสมัคร ถ้าพลาดสร้างที่ทำงานใหม่
 * คนที่รับคำเชิญจะไม่ได้เข้าทีมที่เชิญมา แล้วจะงงกันทั้งสองฝ่าย
 * มีเทสต์ที่นับ COUNT(tenants) ก่อนและหลังคอยจับไว้
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    const joined = await withAccount(user.userId, user.email, (tx) =>
      acceptInvitation(tx, token, { id: user.userId, email: user.email }),
    );
    return ok({ ...joined, next: `/app/${joined.slug}` });
  });
}
