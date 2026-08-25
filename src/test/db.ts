/**
 * ⭐ ฐานข้อมูลสำหรับเทสต์ — และตัวกันไม่ให้เทสต์ล้างฐานของจริง
 *
 * ═══ ทำไมต้องมีไฟล์นี้ ═══
 * เทสต์สั่ง `TRUNCATE` ทุกตารางใน `beforeEach`
 * และเดิมทุกไฟล์เขียน fallback เป็น `…/taronex` ซึ่งเป็น**ฐานเดียวกับที่เว็บจริงใช้**
 * บนเครื่องนี้ `pnpm test` จึงล้างฐานของเว็บจริงทุกครั้งที่รัน โดยไม่มีอะไรเตือนเลย
 *
 * ตอนนี้ยังไม่มีลูกค้าจริงจึงไม่เสียหาย แต่ถ้าปล่อยไว้ วันแรกที่มีข้อมูลจริง
 * จะมีคนรันเทสต์บนเครื่องแล้วข้อมูลหายทั้งหมด
 *
 * ═══ กันสองชั้น ═══
 * 1. ค่าเริ่มต้นชี้ `taronex_test` ไม่ใช่ `taronex`
 * 2. **ปฏิเสธทุกชื่อฐานที่ไม่ลงท้ายด้วย `_test`** — ต่อให้ตั้ง env ผิด เทสต์ก็ไม่ยอมรัน
 *    ชั้นที่สองคือชั้นที่ป้องกันจริง ชั้นแรกแค่ทำให้กรณีปกติถูกต้อง
 */

const DEFAULT_APP = 'postgres://app:devonly@127.0.0.1:5432/taronex_test';
const DEFAULT_OWNER = 'postgres://postgres:devonly@127.0.0.1:5432/taronex_test';

function guard(url: string, which: string): string {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `${which} ชี้ไปที่ฐาน "${name}" ซึ่งไม่ลงท้ายด้วย _test — ` +
        'เทสต์สั่ง TRUNCATE ทุกตาราง จึงไม่ยอมรันกับฐานที่อาจเป็นของจริง\n' +
        'สร้างฐานทดสอบก่อนด้วย: pnpm db:test:setup',
    );
  }
  return url;
}

/** URL ของ role `app` — ตัวที่ RLS บังคับใช้ */
export const TEST_APP_URL = guard(
  process.env.TEST_DATABASE_URL ?? DEFAULT_APP,
  'TEST_DATABASE_URL',
);

/** URL ของเจ้าของตาราง — ใช้ TRUNCATE และใส่ข้อมูลตั้งต้นเท่านั้น */
export const TEST_OWNER_URL = guard(
  process.env.TEST_DATABASE_MIGRATION_URL ?? DEFAULT_OWNER,
  'TEST_DATABASE_MIGRATION_URL',
);
