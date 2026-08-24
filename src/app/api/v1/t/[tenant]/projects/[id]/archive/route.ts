import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { archiveProject } from '@/lib/project-members';

/**
 * POST — ปิดโปรเจกต์ (หรือเปิดคืนด้วย { archived: false })
 *
 * ═══ กฎข้อ 7 · ไม่มี DELETE ในเส้นทางที่เกี่ยวกับเงิน ═══
 * ปิดแล้ว**คืนโควตาทันทีโดยไม่ลบอะไรเลย** การ์ด ไฟล์ ประวัติ นาฬิกา SLA ยังอยู่ครบ
 * นี่คือเหตุผลที่ทั้งระบบไม่มีเส้นทางลบโปรเจกต์เลยแม้แต่เส้นเดียว
 *
 * `requireProjectWrite()` ใช้ไม่ได้ที่นี่เพราะมันปฏิเสธโปรเจกต์ที่ปิดแล้ว
 * ซึ่งจะทำให้เปิดคืนไม่ได้ตลอดกาล — ตรวจสิทธิ์ตรงๆ แทน
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ archived?: boolean }>(req).catch(() => ({}) as { archived?: boolean });

    const result = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      if (p.access !== 'write') throw new ApiError('E_READ_ONLY');
      if (!p.isPm && ctx.role !== 'owner') {
        throw new ApiError('E_PM_ONLY', 'ปิดหรือเปิดโปรเจกต์ได้เฉพาะ PM หรือเจ้าของที่ทำงาน');
      }
      return archiveProject(tx, ctx.tenantId, p.projectId, b.archived ?? true);
    });
    return ok(result);
  });
}
