import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { addComment, listComments } from '@/lib/tasks';

/**
 * GET/POST — คอมเมนต์ของการ์ด
 *
 * กฎข้อ 6 — is_internal ตั้งต้นเป็น true
 * พลาดทางนี้ปลอดภัยกว่า: ลืมตั้งแล้วลูกค้าไม่เห็น ดีกว่าลืมตั้งแล้วลูกค้าเห็นของภายใน
 * เส้นทางนี้เป็นของฝั่งทีม พอร์ทัลมี serializer แยกของตัวเอง
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

async function projectIdOf(tx: Parameters<typeof loadProject>[0], taskId: string): Promise<string> {
  const rows = await tx
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND');
  return row.projectId;
}

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const rows = await inTenant(tenant, async (tx, ctx) => {
      await loadProject(tx, ctx, await projectIdOf(tx, id));
      return listComments(tx, id);
    });
    return ok(rows, { page: 1, total: rows.length });
  });
}

export async function POST(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ body: string; isInternal: boolean }>(req);
    const created = await inTenant(tenant, async (tx, ctx) => {
      requireProjectWrite(await loadProject(tx, ctx, await projectIdOf(tx, id)));
      return addComment(tx, ctx.tenantId, id, ctx.userId, {
        body: str(b.body, 'body'),
        isInternal: b.isInternal,
      });
    });
    return ok(created);
  });
}
