import { eq } from 'drizzle-orm';
import { withoutTenant } from '@/db/client';
import { users } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { currentUser } from '@/lib/auth/session';
import { MAX_AVATAR_BYTES, removeAvatarFile, saveAvatar } from '@/lib/avatar';

/**
 * POST   — อัปรูปโปรไฟล์ (ส่งเนื้อไฟล์ดิบมาตรงๆ)
 * DELETE — เอารูปออก กลับไปใช้อักษรย่อ
 *
 * ═══ ไม่ใช้ presigned URL เหมือนไฟล์แนบ ═══
 * ไฟล์แนบเลี่ยงไม่ให้วิ่งผ่านเครื่องเพราะใหญ่ถึง 50 MB
 * รูปโปรไฟล์จำกัดที่ 512 KB จึงวิ่งผ่านได้ และ**ใช้ได้เลยวันนี้**
 * โดยไม่ต้องรอคีย์ของที่เก็บไฟล์ภายนอก
 *
 * ═══ ไม่เชื่อ Content-Type ที่ส่งมา ═══
 * ตรวจจาก magic bytes ในเนื้อไฟล์เสมอ · ไม่รับ SVG เด็ดขาดเพราะรัน script ได้
 * (ดูเหตุผลเต็มใน `src/lib/avatar.ts`)
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    // ตัดตั้งแต่หัวเรื่องถ้าบอกมาว่าใหญ่เกิน จะได้ไม่ต้องอ่านทั้งก้อนเข้าหน่วยความจำ
    const declared = Number(req.headers.get('content-length') ?? '0');
    if (declared > MAX_AVATAR_BYTES) {
      throw new ApiError('E_INVALID', 'รูปโปรไฟล์ต้องไม่เกิน 512 KB', 'file');
    }

    const buf = Buffer.from(await req.arrayBuffer());
    const url = await saveAvatar(user.userId, buf);

    const previous = user.avatarUrl;
    await withoutTenant((tx) =>
      tx.update(users).set({ avatarUrl: url }).where(eq(users.id, user.userId)),
    );
    // ลบของเก่าหลังบันทึกของใหม่สำเร็จแล้วเท่านั้น
    await removeAvatarFile(previous);

    return ok({ avatarUrl: url });
  });
}

export async function DELETE(): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    await withoutTenant((tx) =>
      tx.update(users).set({ avatarUrl: null }).where(eq(users.id, user.userId)),
    );
    await removeAvatarFile(user.avatarUrl);
    return ok({ avatarUrl: null });
  });
}
