import { withoutTenant, withTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { appUrl, sendEmail } from '@/lib/email/send';
import { portalLinkMail } from '@/lib/email/templates';
import { requestLink } from '@/lib/portal/intake';
import { tenantBySlug } from '@/lib/portal/session';

/**
 * POST — ขอลิงก์เข้าใช้งาน (ไม่ใช้รหัสผ่าน)
 *
 * ⚠ **ตอบเหมือนกันเสมอ** ไม่ว่าอีเมลนั้นจะเป็นผู้ติดต่อของที่ทำงานนี้หรือไม่
 * ถ้าตอบต่างกัน ใครก็ได้จะยิงรายชื่ออีเมลเข้ามาแล้วรู้ว่าบริษัทไหนเป็นลูกค้าของเอเจนซี่รายนี้
 * ซึ่งเป็นข้อมูลทางธุรกิจของลูกค้าเรา ไม่ใช่ของเรา
 */
export const dynamic = 'force-dynamic';

const SAME_ANSWER = {
  sent: true,
  message: 'ถ้าอีเมลนี้ลงทะเบียนไว้ ลิงก์เข้าใช้งานจะถูกส่งไปภายในไม่กี่นาที',
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const b = await body<{ email: string }>(req);
    const email = str(b.email, 'email');

    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const link = await withTenant(tenant.id, (tx) => requestLink(tx, tenant.id, email));

    /**
     * ห้ามส่งโทเคนกลับใน response เด็ดขาด — เท่ากับข้ามการยืนยันอีเมลทั้งขั้นตอน
     * และคำตอบต้องเหมือนกันเสมอ ไม่ว่าจะส่งอีเมลสำเร็จหรือไม่
     * ถ้าตอบต่างกัน คนยิงจะรู้ว่าอีเมลไหนเป็นผู้ติดต่อของที่ทำงานนี้
     */
    if (link) {
      const res = await sendEmail({
        to: email,
        ...portalLinkMail({
          tenantName: tenant.name,
          url: `${appUrl()}/portal/${slug}/login?token=${link.token}`,
        }),
      });
      if (!res.sent) {
        console.warn(
          `[portal] ส่งอีเมลไม่ออก · ลิงก์ของ ${email}: ${appUrl()}/portal/${slug}/login?token=${link.token}`,
        );
      }
    }
    return ok(SAME_ANSWER);
  });
}
