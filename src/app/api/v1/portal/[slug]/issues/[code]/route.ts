import { withoutTenant, withTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { findIssueByCode, portalIssueDetail } from '@/lib/portal/serializer';
import { requirePortalContact, tenantBySlug } from '@/lib/portal/session';

/**
 * GET — สถานะ + วันที่ + ไทม์ไลน์ 5 ขั้นที่เจ้าหน้าที่กดเอง
 *
 * ไทม์ไลน์อ่านจาก `task_events.to_portal_stage` เท่านั้น
 * ไม่แปลงจากการย้ายคอลัมน์ — ทุกขั้นต้องมีคนกดจริง (ตัดสิน 20 ส.ค. 2569)
 * ยังไม่มีใครกด = ตอบว่า "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
 *
 * รหัสที่ไม่ใช่ของผู้ติดต่อคนนี้ตอบ 404 ไม่ใช่ 403 — 403 ยืนยันว่ารหัสนั้นมีอยู่จริง
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; code: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug, code } = await params;
    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const data = await withTenant(tenant.id, async (tx) => {
      const me = await requirePortalContact(tx, tenant.id);
      const taskId = await findIssueByCode(tx, {
        clientId: me.clientId,
        contactId: me.contactId,
        canSeeAll: me.canSeeAll,
        code,
      });
      if (!taskId) throw new ApiError('E_NOT_FOUND');
      const detail = await portalIssueDetail(tx, taskId);
      if (!detail) throw new ApiError('E_NOT_FOUND');
      return detail;
    });
    return ok(data);
  });
}
