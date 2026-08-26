import type { Page } from '@playwright/test';

/**
 * ⭐ ลากการ์ดบนบอร์ดแล้วหย่อนที่พิกัดหนึ่ง
 *
 * ═══ ทำไมต้องมีจังหวะรอคั่น ═══
 * dnd-kit หาว่ามีตัวรับอะไรอยู่ใต้เมาส์จาก event ของ pointer แล้วอัปเดตสถานะผ่าน React
 * `page.mouse.move(..., { steps })` ยิง event ติดกันรัวๆ โดยไม่รอให้ React วาดใหม่
 *
 * เครื่องพัฒนามี 1 vCPU · ช้าพออยู่แล้วให้ dnd-kit ตามทันโดยบังเอิญ
 * แต่ runner ของ CI เร็วกว่ามาก event ทั้งชุดถึงปลายทางก่อนที่ dnd-kit จะรู้ว่า
 * มีอะไรอยู่ใต้เมาส์ `over` เลยเป็น null แล้วการหย่อนก็เงียบ
 * **เทสต์ตกทั้งที่โค้ดของแอปถูก และตกเฉพาะบนเครื่องที่เร็ว**
 *
 * การรอตรงนี้จึงไม่ใช่การกลบปัญหา แต่เป็นการรอสิ่งที่คนจริงรออยู่แล้วโดยธรรมชาติ
 * — คนไม่ได้ลากจากจุด A ไป B ภายในเสี้ยววินาทีเดียว
 */
export async function dragCardTo(page: Page, cardText: string, x: number, y: number) {
  const card = page.locator('.tk', { hasText: cardText }).first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error(`ไม่พบการ์ด ${cardText}`);

  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(120);

  // ต้องขยับเกิน 6px ก่อน ไม่งั้น PointerSensor ไม่นับเป็นการลาก
  await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
  await page.waitForTimeout(120);

  await page.mouse.move(x, y, { steps: 20 });
  await page.waitForTimeout(120);
  // ขยับซ้ำที่จุดเดิมอีกครั้ง ให้ dnd-kit ได้คำนวณ `over` รอบสุดท้ายแน่ๆ
  await page.mouse.move(x, y);
  await page.waitForTimeout(200);

  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** จุดหย่อนกลางคอลัมน์ตามชื่อ — ใช้ตอนอยากหย่อนที่ "พื้นที่ว่าง" */
export async function columnDropPoint(page: Page, columnName: string, fromBottom = 25) {
  const col = page.locator('.bcol', { hasText: columnName }).first();
  await col.scrollIntoViewIfNeeded();
  const b = await col.boundingBox();
  if (!b) throw new Error(`ไม่พบคอลัมน์ ${columnName}`);
  return { x: b.x + b.width / 2, y: b.y + b.height - fromBottom };
}
