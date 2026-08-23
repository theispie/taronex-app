import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { lockBaseline } from '@/lib/projects';

/** POST — บันทึกจำนวนการ์ดตั้งต้น ใช้เทียบว่างานบานปลายไปเท่าไรตอนส่งมอบ */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const r = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, id);
      requireProjectWrite(p);
      return lockBaseline(tx, p.projectId);
    });
    return ok(r);
  });
}
