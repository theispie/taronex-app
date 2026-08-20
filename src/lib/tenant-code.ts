/**
 * รหัสที่ทำงานที่อยู่ใน URL: /app/<code>/...
 *
 * ข้อสำคัญด้านความปลอดภัย — รหัสนี้ "ไม่ใช่" ความลับและ "ไม่ใช่" สิทธิ์
 * มันโผล่ใน URL, ประวัติเบราว์เซอร์ และ log ของ proxy
 * ทุก request ยังต้องตรวจ membership ฝั่งเซิร์ฟเวอร์เสมอ (ดู resolveAccess)
 * รหัสสุ่มมีไว้กันการไล่เดา (enumeration) เท่านั้น
 */

// ตัด 0 O I l 1 ออก เพราะคนอ่านผิดเวลาบอกกันทางโทรศัพท์
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 12;

/** คำที่ห้ามใช้เป็นรหัส เพราะชนกับเส้นทางของระบบ (เผื่อวันที่เปิดให้ตั้งเอง) */
export const RESERVED_CODES = new Set([
  'app',
  'api',
  'portal',
  'readme',
  'admin',
  'login',
  'logout',
  'signup',
  'forgot',
  'reset',
  'invite',
  'account',
  'workspaces',
  'settings',
  'support',
  'static',
  '_next',
  'assets',
  'health',
  'new',
  'me',
  'help',
  'docs',
  'www',
  'internal',
  'v1',
  'meta',
]);

export function generateTenantCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** รูปแบบที่ยอมรับ — รองรับทั้งรหัสสุ่มวันนี้ และ slug ที่ผู้ใช้ตั้งเองในอนาคต */
export function isValidTenantCode(code: string): boolean {
  if (code.length < 3 || code.length > 32) return false;
  if (RESERVED_CODES.has(code)) return false;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(code);
}
