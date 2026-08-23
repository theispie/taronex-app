import { withAccount, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { listWorkspaces } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/**
 * POST /api/v1/auth/switch-tenant
 *
 * เซสชันไม่ผูกกับที่ทำงานอยู่แล้ว การสลับจึงเป็นแค่การบอกว่าจะไปหน้าไหนต่อ
 * ไม่ต้องสร้างเซสชันใหม่เหมือนที่เอกสารเดิมเขียนไว้ (สมัยที่แยกด้วย subdomain)
 * แต่ยังต้องตรวจว่าเป็นสมาชิกจริง ไม่งั้นกลายเป็นเครื่องมือไล่เดารหัสที่ทำงาน
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    const b = await body<{ slug: string }>(req);
    const slug = str(b.slug, 'slug');

    const list = await withAccount(user.userId, user.email, (tx) =>
      listWorkspaces(tx, user.userId),
    );
    const target = list.find((w) => w.slug === slug);
    if (!target) throw new ApiError('E_NOT_FOUND');

    return ok({ slug: target.slug, name: target.name, next: `/app/${target.slug}` });
  });
}
