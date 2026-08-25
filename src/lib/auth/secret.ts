/**
 * ⭐ กุญแจสำหรับเซ็นโทเคนที่ออกไปข้างนอก — ที่เดียวในระบบที่อ่านค่านี้
 *
 * ═══ ทำไมต้องระเบิดตอนไม่มีค่า ═══
 * เดิมเขียนเป็น `process.env.SESSION_SECRET ?? 'dev-only-secret-…'` กระจายอยู่สองไฟล์
 * แล้วเครื่องจริง**ไม่ได้ตั้งค่านี้เลย** ระบบจึงเซ็นด้วยค่าที่อยู่ในโค้ดที่เปิดสาธารณะ
 * ใครก็ได้ปลอมคุกกี้เซสชันพอร์ทัลได้ทันทีถ้ารู้ uuid ของที่ทำงานกับผู้ติดต่อ
 *
 * มันไม่พังตอนทดสอบ ไม่มีอะไรฟ้อง และหน้าเว็บทำงานปกติทุกอย่าง —
 * นั่นคือเหตุผลที่ค่าเริ่มต้นแบบเงียบๆ อันตรายกว่าการไม่มีค่าเริ่มต้นเลย
 *
 * ตอนนี้ถ้า `NODE_ENV=production` แล้วไม่มีค่า **แอปจะโยนข้อผิดพลาดทันที**
 * ยอมให้เปิดไม่ขึ้น ดีกว่าเปิดขึ้นแล้วปลอมเซสชันได้
 */

const DEV_FALLBACK = 'dev-only-secret-do-not-use-in-production';
const MIN_LENGTH = 32;

export function signingSecret(): string {
  const value = process.env.SESSION_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!value || value === DEV_FALLBACK) {
      throw new Error(
        'SESSION_SECRET ยังไม่ได้ตั้งบนเครื่องนี้ — โทเคนที่ออกไปข้างนอกจะถูกเซ็นด้วยค่าที่อยู่ในโค้ด ' +
          'สร้างด้วย `openssl rand -base64 48` แล้วใส่ใน /etc/taronex/web.env',
      );
    }
    if (value.length < MIN_LENGTH) {
      throw new Error(`SESSION_SECRET สั้นเกินไป ต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร`);
    }
  }

  return value ?? DEV_FALLBACK;
}
