import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AVATAR_DIR, contentTypeOf, isSafeAvatarName } from '@/lib/avatar';

/**
 * GET /app/avatars/{ชื่อไฟล์} — เสิร์ฟรูปโปรไฟล์
 *
 * ═══ ทำไมแอปเสิร์ฟเอง ไม่ให้ nginx เสิร์ฟ ═══
 * ครั้งแรกทำเป็น `location /avatars/` ที่ nginx ซึ่งเร็วกว่า
 * แต่เทสต์เบราว์เซอร์จับได้ว่ารูป **404 ตอนรันในเครื่องพัฒนาและบน CI**
 * เพราะสองที่นั้นไม่มี nginx อยู่ในเส้นทาง
 *
 * ของที่ทำงานเฉพาะบนเครื่องจริงคือของที่จะพังเงียบๆ ในวันที่ไม่มีใครดู
 * ยอมให้ไฟล์วิ่งผ่าน Node แลกกับพฤติกรรมที่เหมือนกันทุกที่ —
 * รูปใหญ่สุด 512 KB และมี Cache-Control ที่ทำให้เบราว์เซอร์ไม่ขอซ้ำ
 *
 * ═══ ความปลอดภัย ═══
 * ชื่อไฟล์ต้องผ่านรูปแบบที่เราออกเองเท่านั้น กัน path traversal
 * ตั้ง Content-Type จากนามสกุลที่เรารู้จัก · nosniff · CSP sandbox
 * ต่อให้มีไฟล์แปลกหลุดเข้าไปในโฟลเดอร์ ก็ไม่ถูกตีความเป็น HTML
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  if (!isSafeAvatarName(name)) return new Response('ไม่พบไฟล์', { status: 404 });

  let data: Buffer;
  try {
    data = await readFile(join(AVATAR_DIR, name));
  } catch {
    return new Response('ไม่พบไฟล์', { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      'content-type': contentTypeOf(name),
      // ชื่อไฟล์สุ่มใหม่ทุกครั้งที่เปลี่ยนรูป จึงแคชถาวรได้อย่างปลอดภัย
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
