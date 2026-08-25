import { withAccount, withoutTenant, withTenant } from '@/db/client';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';
import { listWorkspaces } from '@/lib/auth/accounts';
import { currentUser } from '@/lib/auth/session';
import { MAX_WORKSPACES, workspaceCounts } from '@/lib/workspaces';

/**
 * GET /api/v1/me/workspaces — หนึ่งในสี่เส้นทางที่ query ข้าม tenant ได้ (กฎข้อ 11)
 *
 * กรองด้วย user_id ของ session เท่านั้น ไม่รับพารามิเตอร์ใดๆ ที่เปลี่ยนขอบเขตได้
 * และ RLS ยังบังคับซ้ำอีกชั้นด้วย policy ที่เปิดเฉพาะแถวของคนคนนี้
 *
 * ตัวเลขประกอบ (สมาชิก · โปรเจกต์ · รอคุณ) นับทีละที่ทำงานในธุรกรรมของตัวเอง
 * เพราะ policy ของ projects/tasks ยึด app.tenant_id ซึ่งไม่ได้ตั้งใน withAccount()
 * ดูเหตุผลเต็มใน `src/lib/workspaces.ts` — **อย่าแก้ด้วยการเปิด policy ข้าม tenant**
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await withoutTenant((tx) => currentUser(tx));
  if (!user) return fail(new ApiError('E_UNAUTHENTICATED'));

  const workspaces = await withAccount(user.userId, user.email, (tx) =>
    listWorkspaces(tx, user.userId),
  );

  const enriched = [];
  for (const w of workspaces.slice(0, MAX_WORKSPACES)) {
    const counts = await withTenant(w.tenantId, (tx) =>
      workspaceCounts(tx, user.userId, w.role),
    ).catch(() => ({ members: 0, projects: 0, waitingOnYou: 0 }));
    enriched.push({ ...w, ...counts });
  }
  // ที่ทำงานที่มีงานรออยู่ขึ้นก่อน แล้วค่อยเรียงตามชื่อ
  enriched.sort((a, b) => b.waitingOnYou - a.waitingOnYou || a.name.localeCompare(b.name, 'th'));

  return ok(enriched, { page: 1, total: workspaces.length });
}
