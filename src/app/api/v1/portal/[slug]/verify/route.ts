import { withoutTenant, withTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { verifyLink } from '@/lib/portal/intake';
import { requirePortalContact, setPortalCookie, tenantBySlug } from '@/lib/portal/session';

/**
 * POST — แลกโทเคนเป็นเซสชันพอร์ทัล
 *
 * กฎข้อ 6 — คุกกี้คนละชื่อ คนละ secret จากฝั่งทีม
 * เส้นทางนี้ไม่แตะ `tnx_session` เลย ต่อให้ผู้ใช้ล็อกอินฝั่งทีมอยู่ก็ไม่มีผล
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const b = await body<{ token: string }>(req);
    const token = str(b.token, 'token');

    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const contactId = await withTenant(tenant.id, (tx) => verifyLink(tx, tenant.id, token));
    await setPortalCookie(tenant.id, contactId);

    const me = await withTenant(tenant.id, (tx) => requirePortalContact(tx, tenant.id));
    return ok({
      name: me.name,
      clientName: me.clientName,
      tenantName: me.tenantName,
      canReport: me.canReport,
    });
  });
}
