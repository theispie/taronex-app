/**
 * โทเคนที่ส่งออกไปข้างนอก — คำเชิญ · ลิงก์ตั้งรหัสใหม่ · ลิงก์เข้าพอร์ทัล
 *
 * ฐานข้อมูลเก็บเฉพาะ hash ไม่เก็บค่าดิบ ตามที่พจนานุกรมข้อมูลระบุ
 * ถ้าฐานข้อมูลรั่ว โทเคนที่ยังไม่หมดอายุก็ยังใช้ไม่ได้
 *
 * ใช้ SHA-256 ไม่ใช่ argon2 เพราะโทเคนสุ่มมา 256 บิตอยู่แล้ว
 * ไม่มีอะไรให้เดา การถ่วงเวลาจึงไม่ช่วยอะไร มีแต่ทำให้ทุกคำขอช้าลง
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** เทียบแบบเวลาคงที่ กันการวัดเวลาเพื่อเดาทีละตัวอักษร */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const INVITE_TTL_DAYS = 7;
export const RESET_TTL_HOURS = 2;
export const PORTAL_TTL_HOURS = 24;
export const SESSION_TTL_DAYS = 30;

export function expiresIn(ms: number): Date {
  return new Date(Date.now() + ms);
}

export const DAY = 86_400_000;
export const HOUR = 3_600_000;
