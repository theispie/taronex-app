/**
 * กุญแจเซ็นโทเคน — ต้องระเบิดตอนไม่มีค่าบนเครื่องจริง
 *
 * เขียนเทสต์นี้เพราะเครื่องจริงเคยรันอยู่หลายวันโดยไม่ได้ตั้ง `SESSION_SECRET`
 * แล้วเซ็นคุกกี้ด้วยค่าที่อยู่ในโค้ดที่เปิดสาธารณะ — ไม่มีอะไรฟ้องเลยสักอย่าง
 */

import { afterEach, describe, expect, it } from 'vitest';
import { signingSecret } from './secret';

const originalEnv = process.env.NODE_ENV;
const originalSecret = process.env.SESSION_SECRET;

/** NODE_ENV เป็น readonly ในชนิดข้อมูลของ Node แต่เขียนได้จริงตอนรัน */
const env = process.env as Record<string, string | undefined>;

afterEach(() => {
  env.NODE_ENV = originalEnv;
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

function setEnv(mode: string) {
  env.NODE_ENV = mode;
}

describe('signingSecret()', () => {
  it('เครื่องจริงไม่มีค่า → ระเบิด ไม่ใช่เงียบๆ ใช้ค่า dev', () => {
    setEnv('production');
    delete process.env.SESSION_SECRET;
    expect(() => signingSecret()).toThrow(/SESSION_SECRET ยังไม่ได้ตั้ง/);
  });

  it('เครื่องจริงตั้งเป็นค่า dev ที่อยู่ในโค้ด → ระเบิด', () => {
    setEnv('production');
    process.env.SESSION_SECRET = 'dev-only-secret-do-not-use-in-production';
    expect(() => signingSecret()).toThrow(/SESSION_SECRET ยังไม่ได้ตั้ง/);
  });

  it('เครื่องจริงตั้งค่าสั้นเกินไป → ระเบิด', () => {
    setEnv('production');
    process.env.SESSION_SECRET = 'สั้นไป';
    expect(() => signingSecret()).toThrow(/สั้นเกินไป/);
  });

  it('เครื่องจริงตั้งค่ายาวพอ → ผ่าน', () => {
    setEnv('production');
    const good = 'x'.repeat(48);
    process.env.SESSION_SECRET = good;
    expect(signingSecret()).toBe(good);
  });

  it('ตอนพัฒนาไม่มีค่า → ใช้ค่า dev ได้ ไม่ขวางการทำงาน', () => {
    setEnv('development');
    delete process.env.SESSION_SECRET;
    expect(signingSecret()).toContain('dev-only');
  });
});
