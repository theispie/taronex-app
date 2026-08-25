/**
 * รูปโปรไฟล์ — เก็บลงดิสก์ของเครื่อง ยังไม่ได้ใช้ที่เก็บไฟล์ภายนอก
 *
 * ═══ ทำไมไม่ใช้ทางเดียวกับไฟล์แนบ ═══
 * ไฟล์แนบใช้ presigned URL อัปตรงไปที่เก็บไฟล์ เพราะไฟล์ 50 MB วิ่งผ่านเครื่อง 1 GB แล้วตาย
 * แต่ที่เก็บไฟล์ภายนอกยังไม่ได้ต่อ (รอคีย์) และรูปโปรไฟล์ใหญ่สุด 512 KB
 * ซึ่งวิ่งผ่านเครื่องได้สบาย จึงเลือกทางที่**ใช้ได้วันนี้** แทนการรอ
 *
 * ═══ ข้อแลกที่ต้องรู้ ═══
 * ไฟล์อยู่บนดิสก์ของ droplet ตัวนี้ **ไม่ได้อยู่ในสำเนาสำรองของฐานข้อมูล**
 * เครื่องหายเมื่อไหร่รูปหายด้วย (ข้อมูลอื่นไม่หาย เพราะอยู่ใน Postgres)
 * พอต่อ R2/Spaces แล้วให้ย้ายมาที่นั่น — แก้แค่ไฟล์นี้ไฟล์เดียว
 *
 * ═══ ความปลอดภัย ═══
 * รูปถูกเสิร์ฟจาก origin เดียวกับระบบ ถ้าปล่อยให้อัปไฟล์อะไรก็ได้จะกลายเป็นช่อง XSS
 * จึงตรวจ **magic bytes** ไม่เชื่อ Content-Type ที่ผู้ใช้ส่งมา และไม่รับ SVG เด็ดขาด
 * (SVG คือ XML ที่รัน <script> ได้) ชื่อไฟล์สุ่มใหม่เสมอ ไม่เอาชื่อเดิมของผู้ใช้มาใช้
 */

import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ApiError } from '@/lib/api/errors';

export const MAX_AVATAR_BYTES = 512 * 1024;

/** โฟลเดอร์ที่เก็บจริง · แอปเป็นคนเสิร์ฟเอง (ดู `src/app/avatars/[name]/route.ts`) */
export const AVATAR_DIR = process.env.AVATAR_DIR ?? '/var/lib/taronex/avatars';

/**
 * อยู่ใต้ basePath `/app` โดยตั้งใจ — เส้นทางนี้จึงทำงานเหมือนกันทั้งเครื่องพัฒนา CI และเครื่องจริง
 * ครั้งแรกวางไว้ที่ `/avatars` แล้วให้ nginx เสิร์ฟ ซึ่ง 404 ทุกที่ที่ไม่มี nginx
 */
const PUBLIC_PREFIX = '/app/avatars';

/** ชื่อไฟล์ที่เราออกเอง — uuid ของคน + uuid สุ่ม + นามสกุลที่รู้จัก */
export function isSafeAvatarName(name: string): boolean {
  return /^[a-f0-9-]+\.(png|jpg|webp)$/i.test(name);
}

export function contentTypeOf(name: string): string {
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg')) return 'image/jpeg';
  return 'image/webp';
}

/** ชนิดที่รับ — รายการอนุญาต ไม่ใช่รายการห้าม · **ไม่มี SVG โดยตั้งใจ** */
const SIGNATURES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP',
  },
];

export function detectImage(buf: Buffer): { ext: string; mime: string } {
  const hit = SIGNATURES.find((s) => s.test(buf));
  if (!hit) {
    throw new ApiError(
      'E_INVALID',
      'รับเฉพาะไฟล์ภาพ PNG · JPG · WebP (ตรวจจากเนื้อไฟล์จริง ไม่ใช่จากนามสกุล)',
      'file',
    );
  }
  return { ext: hit.ext, mime: hit.mime };
}

/**
 * เขียนรูปใหม่แล้วคืน URL สาธารณะ
 * ชื่อไฟล์ขึ้นต้นด้วย user_id เพื่อให้ลบของคนคนเดียวได้ทั้งก้อนในวันที่เขาลบบัญชี
 */
export async function saveAvatar(userId: string, buf: Buffer): Promise<string> {
  if (buf.byteLength === 0) throw new ApiError('E_INVALID', 'ไฟล์ว่าง', 'file');
  if (buf.byteLength > MAX_AVATAR_BYTES) {
    throw new ApiError('E_INVALID', 'รูปโปรไฟล์ต้องไม่เกิน 512 KB', 'file');
  }
  const { ext } = detectImage(buf);

  await mkdir(AVATAR_DIR, { recursive: true });
  const name = `${userId}-${randomUUID()}.${ext}`;
  await writeFile(join(AVATAR_DIR, name), buf, { mode: 0o644 });
  return `${PUBLIC_PREFIX}/${name}`;
}

/**
 * ลบไฟล์เก่าทิ้ง — เงียบเสมอถ้าลบไม่ได้
 *
 * รูปเก่าค้างอยู่ไม่ทำให้อะไรพัง แต่ถ้าโยนข้อผิดพลาดออกไป
 * การเปลี่ยนรูปจะล้มเหลวทั้งที่รูปใหม่เขียนสำเร็จแล้ว ซึ่งแย่กว่ามาก
 */
export async function removeAvatarFile(url: string | null): Promise<void> {
  if (!url?.startsWith(`${PUBLIC_PREFIX}/`)) return;
  const name = url.slice(PUBLIC_PREFIX.length + 1);
  // กัน path traversal — ชื่อไฟล์ที่เราออกเองมีแค่ตัวอักษร ตัวเลข ขีด และจุดเดียว
  if (!isSafeAvatarName(name)) return;
  await unlink(join(AVATAR_DIR, name)).catch(() => {});
}
