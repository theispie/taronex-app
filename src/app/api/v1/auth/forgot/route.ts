import { withoutTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createResetToken } from '@/lib/auth/accounts';
import { appUrl, sendEmail } from '@/lib/email/send';
import { resetMail } from '@/lib/email/templates';

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

    /**
     * คำตอบเหมือนกันเสมอ ไม่ว่าจะมีบัญชีหรือไม่ และไม่ว่าส่งอีเมลสำเร็จหรือไม่
     * ถ้าตอบต่างกันเมื่อไหร่ หน้านี้จะกลายเป็นเครื่องมือไล่เช็คว่าอีเมลไหนมีบัญชี
     */
    if (token) {
      const res = await sendEmail({
        to: email,
        ...resetMail({ url: `${appUrl()}/reset?t=${token}` }),
      });
      if (!res.sent) console.warn(`[dev] ลิงก์ตั้งรหัสใหม่: ${appUrl()}/reset?t=${token}`);
    }
    return ok({ message: 'ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสใหม่ไปให้แล้ว' });
  });
}
