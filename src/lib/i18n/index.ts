/**
 * ⚠ ไฟล์นี้ต้องปลอดภัยสำหรับ client component
 *
 * `serverLocale()` ใช้ `next/headers` ซึ่งอยู่ในนี้ไม่ได้ —
 * ถ้าอยู่ client component ที่ import จากไฟล์นี้จะลาก next/headers ติดไปด้วยแล้ว build พัง
 * (เจอมาแล้ว) · ฝั่งเซิร์ฟเวอร์ให้ import จาก '@/lib/i18n/server' ตรงๆ
 */

export { type DictKey, translate } from './dictionary';
export { LocaleProvider, useLocale, useT } from './provider';
export {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_LABEL,
  LOCALES,
  type Locale,
} from './types';
