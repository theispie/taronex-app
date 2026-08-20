import { runAudit } from '@/lib/api/audit';
import { API_BASE, countByMilestone, countByStatus, GROUPS } from '@/lib/api/registry';
import { ok } from '@/lib/api/respond';

/**
 * GET /api/v1/meta/endpoints — ทะเบียน endpoint ทั้งชุด + ผลตรวจกฎ
 *
 * มีไว้ให้หน้า /internal/api และให้คนเรียกดูจากบรรทัดคำสั่งได้
 * ไม่มีข้อมูลผู้ใช้อยู่ในคำตอบนี้เลย มีแต่รูปร่างของ API เอง
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return ok({
    base: API_BASE,
    groups: GROUPS,
    summary: countByStatus(),
    byMilestone: countByMilestone(),
    audit: runAudit(),
  });
}
