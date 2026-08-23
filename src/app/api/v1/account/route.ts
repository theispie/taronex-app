import { withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { updateAccount } from '@/lib/auth/accounts';
import { clearSessionCookie, currentUser } from '@/lib/auth/session';

/**
 * PATCH /api/v1/account — ข้อมูลของคน ไม่ใช่ของที่ทำงาน
 * ตำแหน่งงานไม่ได้อยู่ที่นี่ เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน (อยู่ที่ PATCH /me)
 */
export const dynamic = 'force-dynamic';

interface Patch {
  name: string;
  locale: string;
  password: string;
  currentPassword: string;
}

export async function PATCH(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    const b = await body<Patch>(req);
    await withoutTenant((tx) => updateAccount(tx, user.userId, b));

    // เปลี่ยนรหัสแล้วเซสชันตายหมด รวมเครื่องนี้ด้วย
    if (b.password) {
      await clearSessionCookie();
      return ok({ message: 'เปลี่ยนรหัสแล้ว กรุณาเข้าสู่ระบบอีกครั้ง', reauth: true });
    }
    return ok({ ok: true });
  });
}
