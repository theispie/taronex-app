import { withoutTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { resetPassword, verifyResetToken } from '@/lib/auth/accounts';
import { clearSessionCookie } from '@/lib/auth/session';

/**
 * POST /api/v1/auth/reset — ตั้งรหัสใหม่ + ทำลาย session ทุกเครื่อง
 * รวมเครื่องที่กำลังใช้อยู่ด้วย เพราะถ้ารหัสหลุดต้องเตะคนที่สวมสิทธิ์ออกให้หมด
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const b = await body<{ token: string; password: string }>(req);
    const token = str(b.token, 'token');
    const password = str(b.password, 'password');

    await withoutTenant(async (tx) => {
      const userId = await verifyResetToken(tx, token);
      await resetPassword(tx, userId, password);
    });
    await clearSessionCookie();
    return ok({ message: 'ตั้งรหัสใหม่แล้ว กรุณาเข้าสู่ระบบอีกครั้ง' });
  });
}
