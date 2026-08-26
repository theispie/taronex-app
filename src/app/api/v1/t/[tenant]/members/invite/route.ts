import { inTenant, requireOwner } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { inviteMember, type JobTitleValue, type Role } from '@/lib/auth/accounts';
import { appUrl, sendEmail } from '@/lib/email/send';
import { inviteMail } from '@/lib/email/templates';

/** POST /api/v1/t/{tenant}/members/invite — ส่งได้หลายอีเมลในครั้งเดียว */
export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['owner', 'member', 'viewer', 'guest'];
const TITLES: JobTitleValue[] = ['pm', 'ba', 'dev', 'qa', 'design', 'other'];

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของที่ทำงาน',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ emails: string[]; role: string; jobTitle: string }>(req);

    const emails = Array.isArray(b.emails) ? b.emails : [str(b.emails, 'emails')];
    if (emails.length === 0) throw new ApiError('E_INVALID', 'ใส่อีเมลอย่างน้อยหนึ่งคน', 'emails');

    const role = (ROLES as string[]).includes(String(b.role)) ? (b.role as Role) : 'member';
    const jobTitle = (TITLES as string[]).includes(String(b.jobTitle))
      ? (b.jobTitle as JobTitleValue)
      : 'other';

    const result = await inTenant(tenant, async (tx, ctx) => {
      // เชิญคนเข้าทีมเปลี่ยนใครเข้าถึงข้อมูลได้ จึงจำกัดที่เจ้าของ
      requireOwner(ctx);
      const out: {
        email: string;
        token: string;
        tenantName: string;
        invitedByName: string | null;
      }[] = [];
      for (const e of emails) {
        const token = await inviteMember(tx, ctx.tenantId, ctx.userId, {
          email: str(e, 'emails'),
          role,
          jobTitle,
        });
        out.push({ email: e, token, tenantName: ctx.tenantName, invitedByName: ctx.name });
      }
      return out;
    });

    /**
     * ส่งอีเมลหลังธุรกรรมปิดแล้วเท่านั้น
     *
     * ถ้าส่งข้างในธุรกรรม แล้วธุรกรรมถูกยกเลิกทีหลัง อีเมลจะออกไปแล้ว
     * คนจะได้ลิงก์คำเชิญที่ใช้ไม่ได้ ซึ่งอธิบายยากกว่าไม่ได้อีเมลเลย
     */
    const sent: string[] = [];
    for (const r of result) {
      const res = await sendEmail({
        to: r.email,
        ...inviteMail({
          tenantName: r.tenantName,
          invitedByName: r.invitedByName,
          roleLabel: ROLE_LABEL[role] ?? role,
          url: `${appUrl()}/invite/${r.token}`,
        }),
      });
      if (res.sent) sent.push(r.email);
      else console.info(`[dev] คำเชิญ ${r.email}: ${appUrl()}/invite/${r.token}`);
    }

    return ok({
      invited: result.map((r) => r.email),
      count: result.length,
      /** บอกตรงๆ ว่าส่งออกไปกี่ฉบับ — หน้าเว็บจะได้ไม่บอกว่า "ส่งแล้ว" ทั้งที่ไม่ได้ส่ง */
      emailed: sent.length,
    });
  });
}
