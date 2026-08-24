import { withoutTenant, withTenant } from '@/db/client';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { createIssue, openProjects } from '@/lib/portal/intake';
import { listPortalIssues } from '@/lib/portal/serializer';
import { requirePortalContact, tenantBySlug } from '@/lib/portal/session';

/**
 * GET  — เรื่องของผู้ติดต่อคนนี้เท่านั้น (หรือทั้งบริษัทถ้า can_see_all)
 * POST — ลูกค้ากดส่งเรื่องใหม่ · **นาฬิกา SLA เริ่มเดินที่นี่**
 *
 * ทั้งสองเส้นผ่าน serializer ตัวเดียวกับหน้า "ดูอย่างที่ลูกค้าเห็น" ของฝั่งทีม (กฎข้อ 6)
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const data = await withTenant(tenant.id, async (tx) => {
      const me = await requirePortalContact(tx, tenant.id);
      const lists = await listPortalIssues(tx, {
        clientId: me.clientId,
        contactId: me.contactId,
        canSeeAll: me.canSeeAll,
      });
      return {
        ...lists,
        me: { name: me.name, clientName: me.clientName, canReport: me.canReport },
        projects: me.canReport ? await openProjects(tx, me.clientId) : [],
      };
    });
    return ok(data);
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const b = await body<{
      title: string;
      description?: string;
      reportedImpact?: 'blocking' | 'degraded' | 'minor';
      projectId?: string;
    }>(req);
    const title = str(b.title, 'title');

    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const created = await withTenant(tenant.id, async (tx) => {
      const me = await requirePortalContact(tx, tenant.id);
      return createIssue(tx, me, {
        title,
        description: b.description,
        reportedImpact: b.reportedImpact,
        projectId: b.projectId,
      });
    });
    return ok(created);
  });
}
