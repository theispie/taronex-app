import { withoutTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { currentUser } from '@/lib/auth/session';

/**
 * GET /api/v1/auth/me — ใครล็อกอินอยู่
 *
 * ═══ คืนแค่ตัวตน ไม่คืนรายการที่ทำงาน ═══
 * รายการที่ทำงานเป็นข้อมูลข้าม tenant ซึ่งกฎข้อ 11 อนุญาตแค่สี่เส้นทาง
 * และ /auth/me ไม่ได้อยู่ในสี่เส้นทางนั้น ถ้าคืนมาด้วยก็จะกลายเป็นเส้นทางที่ห้า
 * หน้าไหนต้องการรายการที่ทำงานให้เรียก GET /me/workspaces
 *
 * ส่วนบทบาทในที่ทำงานหนึ่งๆ อยู่ที่ GET /t/{tenant}/workspace (ฟิลด์ yourRole)
 * เพราะที่ทำงานปัจจุบันมาจาก URL ไม่ใช่จากเซสชัน
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await withoutTenant((tx) => currentUser(tx));
  if (!user) return fail(new ApiError('E_UNAUTHENTICATED'));
  return ok({ user });
}
