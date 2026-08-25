/**
 * รูปโปรไฟล์ — ชั้นที่กันไม่ให้ไฟล์อัปโหลดกลายเป็นช่อง XSS
 *
 * รูปถูกเสิร์ฟจาก origin เดียวกับระบบ ถ้าปล่อยให้อัปอะไรก็ได้แล้วเบราว์เซอร์
 * ตีความเป็น HTML/SVG จะรันสคริปต์ในบริบทของโดเมนเรา = ขโมยเซสชันได้
 * เทสต์ชุดนี้จึงสำคัญกว่าเรื่องรูปสวยไม่สวย
 */

import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIR = join(tmpdir(), `avatar-test-${process.pid}`);
process.env.AVATAR_DIR = DIR;

const { detectImage, saveAvatar, removeAvatarFile, MAX_AVATAR_BYTES } = await import('./avatar');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.from([0, 0, 0, 0]),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

beforeAll(async () => {
  await rm(DIR, { recursive: true, force: true });
});
afterAll(async () => {
  await rm(DIR, { recursive: true, force: true });
});

describe('ตรวจชนิดจากเนื้อไฟล์ ไม่ใช่จากนามสกุลหรือ Content-Type', () => {
  it('รับ PNG · JPG · WebP', () => {
    expect(detectImage(PNG).ext).toBe('png');
    expect(detectImage(JPG).ext).toBe('jpg');
    expect(detectImage(WEBP).ext).toBe('webp');
  });

  it('⭐ ไม่รับ SVG — เป็น XML ที่รัน script ได้', () => {
    expect(() => detectImage(SVG)).toThrow(/PNG · JPG · WebP/);
  });

  it('⭐ ไม่รับ HTML ที่แอบอ้างว่าเป็นรูป', () => {
    expect(() => detectImage(HTML)).toThrow();
  });

  it('ไฟล์ว่างหรือสั้นเกินไปก็ไม่รับ', () => {
    expect(() => detectImage(Buffer.alloc(0))).toThrow();
    expect(() => detectImage(Buffer.from([0x89]))).toThrow();
  });
});

describe('เขียนไฟล์', () => {
  const uid = '11111111-2222-3333-4444-555555555555';

  it('ชื่อไฟล์สุ่มใหม่เสมอ · นามสกุลมาจากชนิดที่ตรวจได้ ไม่ใช่จากผู้ใช้', async () => {
    const a = await saveAvatar(uid, PNG);
    const b = await saveAvatar(uid, PNG);
    expect(a).not.toBe(b);
    expect(a.endsWith('.png')).toBe(true);
    expect(a.startsWith(`/app/avatars/${uid}-`)).toBe(true);
  });

  it('ใหญ่เกิน 512 KB ไม่รับ', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_AVATAR_BYTES)]);
    await expect(saveAvatar(uid, big)).rejects.toThrow(/512 KB/);
  });

  it('ไฟล์ว่างไม่รับ', async () => {
    await expect(saveAvatar(uid, Buffer.alloc(0))).rejects.toThrow(/ว่าง/);
  });
});

describe('⭐ ลบไฟล์ — กัน path traversal', () => {
  it('ไม่แตะอะไรเมื่อ URL ไม่ได้อยู่ใต้ /avatars/', async () => {
    await expect(removeAvatarFile('/etc/passwd')).resolves.toBeUndefined();
    await expect(removeAvatarFile('https://evil.co/x.png')).resolves.toBeUndefined();
    await expect(removeAvatarFile(null)).resolves.toBeUndefined();
  });

  it('ไม่ยอมชื่อไฟล์ที่มี .. หรือ /', async () => {
    await expect(removeAvatarFile('/app/avatars/../../etc/passwd')).resolves.toBeUndefined();
    await expect(removeAvatarFile('/app/avatars/..%2Fpasswd')).resolves.toBeUndefined();
  });

  it('ลบไฟล์ที่เราออกเองได้จริง', async () => {
    const url = await saveAvatar('99999999-2222-3333-4444-555555555555', JPG);
    await expect(removeAvatarFile(url)).resolves.toBeUndefined();
  });
});
