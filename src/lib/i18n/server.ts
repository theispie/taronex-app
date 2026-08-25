import { cookies } from 'next/headers';
import { withoutTenant } from '@/db/client';
import { currentUser } from '@/lib/auth/session';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './types';

/**
 * ภาษาของคำขอนี้ — ใช้ใน server component
 *
 * คุกกี้มาก่อนค่าในฐานข้อมูล เพราะคนเพิ่งกดสลับภาษาต้องเห็นผลทันที
 * โดยไม่ต้องรอให้เขียนฐานเสร็จ · ฐานข้อมูลเป็นตัวจำข้ามเครื่อง
 */
export async function serverLocale(): Promise<Locale> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const user = await withoutTenant((tx) => currentUser(tx)).catch(() => null);
  if (isLocale(user?.locale)) return user.locale;

  return DEFAULT_LOCALE;
}
