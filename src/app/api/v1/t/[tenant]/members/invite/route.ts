import { inTenant, requireOwner } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { inviteMember, type JobTitleValue, type Role } from '@/lib/auth/accounts';

/** POST /api/v1/t/{tenant}/members/invite — ส่งได้หลายอีเมลในครั้งเดียว */
export const dynamic = 'force-dynamic';

const ROLES: Role[] = ['owner', 'member', 'viewer', 'guest'];
const TITLES: JobTitleValue[] = ['pm', 'ba', 'dev', 'qa', 'design', 'other'];

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
      const out: { email: string; token: string }[] = [];
      for (const e of emails) {
        const token = await inviteMember(tx, ctx.tenantId, ctx.userId, {
          email: str(e, 'emails'),
          role,
          jobTitle,
        });
        out.push({ email: e, token });
      }
      return out;
    });

    // ยังไม่ได้ต่อ Resend — บันทึกลิงก์ลง log ไว้ก่อนสำหรับตอนพัฒนา
    if (process.env.NODE_ENV !== 'production') {
      for (const r of result) console.info(`[dev] คำเชิญ ${r.email}: /app/invite/${r.token}`);
    }
    return ok({ invited: result.map((r) => r.email), count: result.length });
  });
}
