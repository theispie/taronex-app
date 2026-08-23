/**
 * รหัสผ่าน — argon2id ตามที่พจนานุกรมข้อมูลระบุ
 *
 * ค่าพารามิเตอร์ตั้งให้พอดีกับเครื่อง 1 GB
 * memoryCost 19 MiB เป็นค่าที่ OWASP แนะนำเป็นขั้นต่ำ และคูณกับ parallelism แล้ว
 * ยังไม่กินจนเบียด Postgres ที่จองไว้ 200 MB
 */

import { hash, verify } from '@node-rs/argon2';

const OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

/**
 * คืน false แทนการโยนเมื่อ hash ในฐานข้อมูลเสีย
 * เพราะเส้นทางล็อกอินไม่ควรบอกความต่างระหว่าง "รหัสผิด" กับ "ข้อมูลมีปัญหา"
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, OPTS);
  } catch {
    return false;
  }
}

/** กติกาขั้นต่ำ — ยาวสำคัญกว่าความซับซ้อน */
export function passwordProblems(plain: string): string[] {
  const errs: string[] = [];
  if (plain.length < 10) errs.push('รหัสผ่านต้องยาวอย่างน้อย 10 ตัว');
  if (plain.length > 200) errs.push('รหัสผ่านยาวเกินไป');
  return errs;
}
