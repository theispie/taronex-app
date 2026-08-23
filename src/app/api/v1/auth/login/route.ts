import { withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { login } from '@/lib/auth/accounts';
import { setSessionCookie } from '@/lib/auth/session';

/**
 * POST /api/v1/auth/login
 * ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือรหัสผิด — ดูเหตุผลใน accounts.ts
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      throw new ApiError('E_INVALID', 'กรอกอีเมลและรหัสผ่าน');
    }
    const token = await withoutTenant((tx) =>
      login(tx, body.email as string, body.password as string),
    );
    await setSessionCookie(token);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}
