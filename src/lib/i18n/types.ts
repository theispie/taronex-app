/**
 * สองภาษา ไทย–อังกฤษ
 *
 * ═══ ไทยเป็นภาษาหลัก ไม่ใช่ภาษาแปล ═══
 * สินค้านี้ทำให้ SME ไทย ข้อความไทยจึงเป็นต้นฉบับที่คิดมาอย่างดีแล้ว
 * (สเปคหน้าจอมีหัวข้อ "ถ้อยคำ (ห้ามแปลใหม่)" กำกับหลายหน้า)
 * อังกฤษเป็นทางเลือกสำหรับทีมที่มีคนต่างชาติ — ไม่ใช่ค่าเริ่มต้น
 *
 * ═══ ใช้กุญแจ ไม่ใช่ข้อความไทยเป็นกุญแจ ═══
 * ถ้าใช้ข้อความไทยเป็นกุญแจ พอแก้คำไทยนิดเดียวคำแปลอังกฤษจะหลุดเงียบๆ
 * กุญแจแยกทำให้ TypeScript จับได้ตอน build ว่าพจนานุกรมไหนขาดคำไหน
 *
 * ═══ ที่มาของภาษา เรียงตามลำดับ ═══
 * 1. คุกกี้ `tnx_locale` — เปลี่ยนแล้วมีผลทันทีทุกหน้า รวมหน้าที่ยังไม่ล็อกอิน
 * 2. `users.locale` ในฐานข้อมูล — ติดไปกับบัญชี เปลี่ยนเครื่องแล้วยังตามมา
 * 3. ไทย
 */

export const LOCALES = ['th', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'th';
export const LOCALE_COOKIE = 'tnx_locale';

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

export const LOCALE_LABEL: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
};
