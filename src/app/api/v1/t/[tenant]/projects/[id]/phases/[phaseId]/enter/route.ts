import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { enterPhase } from '@/lib/projects';

/**
 * POST — ย้ายโปรเจกต์เข้าเฟสนี้
 * เฟสชนิด warranty เป็นสวิตช์ที่เปิดพอร์ทัลลูกค้า ตั้ง portal_enabled เองโดยตรงไม่ได้
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string; phaseId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id, phaseId } = await params;
    const r = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      return enterPhase(tx, p.projectId, phaseId);
    });
    return ok(r);
  });
}
