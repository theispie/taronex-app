import { withNewTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { signup } from '@/lib/auth/accounts';
import { setSessionCookie } from '@/lib/auth/session';

/** POST /api/v1/auth/signup — สร้าง tenant + owner + session ในธุรกรรมเดียว */
export const dynamic = 'force-dynamic';

interface Body {
  companyName?: unknown;
  name?: unknown;
  email?: unknown;
  password?: unknown;
}

const str = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ApiError('E_INVALID', 'กรอกข้อมูลให้ครบ', field);
  }
  return v;
};

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const input = {
      companyName: str(body.companyName, 'companyName'),
      name: str(body.name, 'name'),
      email: str(body.email, 'email'),
      password: str(body.password, 'password'),
    };

    const result = await withNewTenant((tx, enter) => signup(tx, enter, input));
    await setSessionCookie(result.token);
    return ok({ tenantId: result.tenantId, slug: result.slug, next: `/app/${result.slug}` });
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}
