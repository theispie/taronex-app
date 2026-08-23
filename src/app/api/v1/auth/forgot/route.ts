import { withoutTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createResetToken } from '@/lib/auth/accounts';

/**
 * POST /api/v1/auth/forgot
 * ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือไม่ — ไม่งั้นกลายเป็นเครื่องมือไล่เช็คว่าใครมีบัญชี
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const b = await body<{ email: string }>(req);
    const email = str(b.email, 'email');
    const token = await withoutTenant((tx) => createResetToken(tx, email));

    // ยังไม่ได้ต่อ Resend — บันทึกลิงก์ลง log ไว้ก่อนสำหรับตอนพัฒนา
    if (token && process.env.NODE_ENV !== 'production') {
      console.info(`[dev] ลิงก์ตั้งรหัสใหม่: /app/reset?t=${token}`);
    }
    return ok({ message: 'ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสใหม่ไปให้แล้ว' });
  });
}
