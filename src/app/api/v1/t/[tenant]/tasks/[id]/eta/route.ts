import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { type Eta, setEta } from '@/lib/tasks';

/**
 * PATCH — คำตอบ "จะเสร็จเมื่อไร"
 * แยกจาก due_date โดยตั้งใจ · due_date คือสัญญากับลูกค้า · eta คือความเห็นล่าสุดของคนทำ
 */
export const dynamic = 'force-dynamic';

const VALUES: Eta[] = ['today', 'tomorrow', 'this_week', 'unknown'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ eta: string }>(req);
    if (!(VALUES as string[]).includes(String(b.eta))) {
      throw new ApiError('E_INVALID', 'ค่าที่ใช้ได้: today · tomorrow · this_week · unknown', 'eta');
    }
    await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({ projectId: tasks.projectId })
        .from(tasks)
        .where(eq(tasks.id, id))
        .limit(1);
      if (!rows[0]) throw new ApiError('E_NOT_FOUND');
      requireProjectWrite(await loadProject(tx, ctx, rows[0].projectId));
      await setEta(tx, id, b.eta as Eta);
    });
    return ok({ ok: true });
  });
}
