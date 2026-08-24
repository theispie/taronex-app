import { eq } from 'drizzle-orm';
import { withPortalStageChange } from '@/db/client';
import { tasks } from '@/db/schema';
import { requireTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import type { PortalStageKey } from '@/lib/portal/serializer';
import { setPortalStage } from '@/lib/portal/stage';

/**
 * ⭐ POST — ประตูเดียวที่สถานะฝั่งลูกค้าเปลี่ยน · { stage, note? }
 *
 * ═══ ต้องมีคนกดเสมอ ไม่มี auto (ตัดสิน 20 ส.ค. 2569) ═══
 * ไม่มีที่ไหนในระบบตั้ง `portal_stage` ให้เองจากการย้ายคอลัมน์
 * trigger `guard_portal_stage` ปฏิเสธ UPDATE จากธุรกรรมอื่นที่ชั้นฐานข้อมูล
 * ใบอนุญาตที่ `withPortalStageChange()` ตั้งให้เป็น LOCAL จึงหมดอายุพร้อมธุรกรรม
 *
 * ปุ่ม "รับเรื่อง" เรียกเส้นนี้ด้วย stage=received และรับเป็นเจ้าของถ้ายังไม่มีใครถือ
 * stage=resolved เฉพาะ PM — เป็นคำสัญญากับลูกค้า ไม่ใช่แค่ป้ายสถานะ
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ stage: string; note?: string }>(req);
    const stage = str(b.stage, 'stage') as PortalStageKey;

    const ctx = await requireTenant(tenant);
    const result = await withPortalStageChange(ctx.tenantId, async (tx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      const t = rows[0];
      if (!t) throw new ApiError('E_NOT_FOUND');

      const p = await loadProject(tx, ctx, t.projectId);
      requireProjectWrite(p);
      return setPortalStage(tx, id, stage, { userId: ctx.userId, isPm: p.isPm }, b.note);
    });
    return ok(result);
  });
}
