import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { withoutTenant } from '@/db/client';
import { users } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { currentUser } from '@/lib/auth/session';
import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';

/**
 * PUT — สลับภาษา
 *
 * เขียนสองที่พร้อมกันโดยตั้งใจ
 *   คุกกี้ — มีผลทันทีทุกหน้า รวมหน้าที่ยังไม่ได้ล็อกอิน (เช่นหน้าเข้าสู่ระบบ)
 *   ฐานข้อมูล — ติดไปกับบัญชี เปลี่ยนเครื่องแล้วยังเป็นภาษาเดิม
 *
 * คนที่ยังไม่ล็อกอินก็สลับได้ แค่ได้เฉพาะคุกกี้ ไม่มีบัญชีให้จำ
 */
export const dynamic = 'force-dynamic';

const YEAR = 365 * 24 * 3600;

export async function PUT(req: Request): Promise<Response> {
  return handle(async () => {
    const b = await body<{ locale: string }>(req);
    if (!isLocale(b.locale)) {
      throw new ApiError('E_INVALID', 'ภาษาที่รองรับตอนนี้มีไทยกับอังกฤษ', 'locale');
    }

    const jar = await cookies();
    jar.set(LOCALE_COOKIE, b.locale, {
      httpOnly: false, // ไม่ใช่ความลับ · ให้ฝั่งหน้าเว็บอ่านได้ด้วย
      sameSite: 'lax',
      path: '/',
      maxAge: YEAR,
      secure: process.env.NODE_ENV === 'production',
    });

    const user = await withoutTenant((tx) => currentUser(tx)).catch(() => null);
    if (user) {
      await withoutTenant((tx) =>
        tx.update(users).set({ locale: b.locale }).where(eq(users.id, user.userId)),
      );
    }
    return ok({ locale: b.locale });
  });
}
