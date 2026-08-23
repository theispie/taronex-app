import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { projectHealth } from '@/lib/projects';

/**
 * GET — ตัวเลขสุขภาพโปรเจกต์ คำนวณสดทุกครั้ง ไม่เก็บเป็นคอลัมน์
 * กฎข้อ 9: เป็นตัวเลขระดับโปรเจกต์ ไม่ใช่ระดับคน จึงเอาไปเรียงลำดับคนไม่ได้
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return projectHealth(tx, p.projectId);
    });
    return ok(data);
  });
}
