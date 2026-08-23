import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { listFiles } from '@/lib/tasks';

/** GET — ไฟล์ทั้งโปรเจกต์ · ไม่คืน storage_key ออกไป ต้องขอลิงก์ผ่านเส้นทางดาวน์โหลด */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      return listFiles(tx, p.projectId);
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}
