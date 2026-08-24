import { withoutTenant, withTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { openProjects } from '@/lib/portal/intake';
import { requirePortalContact, tenantBySlug } from '@/lib/portal/session';
import { buildKey, checkUpload, presignUpload } from '@/lib/storage';

/**
 * POST — ลิงก์อัปโหลดสำหรับลูกค้า · **จำกัดชนิดไฟล์เข้มกว่าฝั่งทีม**
 *
 * ลูกค้าแนบมาเพื่ออธิบายปัญหา ภาพหน้าจอกับ PDF พอแล้ว
 * ไฟล์ zip หรือไฟล์ office จากคนนอกองค์กรเป็นความเสี่ยงที่ไม่ได้แลกอะไรกลับมา
 */
export const dynamic = 'force-dynamic';

/** รายการนี้แคบกว่า ALLOWED_MIME ของฝั่งทีมโดยตั้งใจ */
const PORTAL_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const PORTAL_MAX_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const b = await body<{ filename: string; mime: string; size: number; projectId?: string }>(req);
    const filename = str(b.filename, 'filename');
    const mime = str(b.mime, 'mime');
    const size = Number(b.size);

    if (!PORTAL_MIME.has(mime)) {
      throw new ApiError('E_INVALID', 'แนบได้เฉพาะภาพ (PNG, JPG, WebP) และ PDF', 'mime');
    }
    if (!Number.isFinite(size) || size <= 0 || size > PORTAL_MAX_BYTES) {
      throw new ApiError('E_INVALID', 'ไฟล์ต้องไม่เกิน 10 MB', 'size');
    }
    checkUpload(filename, mime, size);

    const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug));
    const key = await withTenant(tenant.id, async (tx) => {
      const me = await requirePortalContact(tx, tenant.id);
      if (!me.canReport) throw new ApiError('E_FORBIDDEN', 'บัญชีนี้แนบไฟล์ไม่ได้');
      const available = await openProjects(tx, me.clientId);
      const target = b.projectId
        ? available.find((p) => p.id === b.projectId)
        : available.length === 1
          ? available[0]
          : undefined;
      if (!target) throw new ApiError('E_INVALID', 'เลือกโปรเจกต์ที่ต้องการแจ้งด้วย', 'projectId');
      return buildKey(tenant.id, target.id, filename);
    });

    const uploadUrl = await presignUpload(key, mime);
    return ok({ uploadUrl, storageKey: key, expiresInSeconds: 300 });
  });
}
