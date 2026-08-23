import { withNewTenant, withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createWorkspace } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';

/** POST /api/v1/workspaces — สร้างที่ทำงานใหม่จากบัญชีเดิม ไม่สร้าง users ใหม่ (กฎข้อ 11) */
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await withoutTenant((tx) => currentUser(tx));
    if (!user) throw new ApiError('E_UNAUTHENTICATED');

    const b = await body<{ name: string }>(req);
    const name = str(b.name, 'name');

    const created = await withNewTenant((tx, enter) =>
      createWorkspace(tx, enter, user.userId, name),
    );
    return ok({ ...created, next: `/app/${created.slug}` });
  });
}
