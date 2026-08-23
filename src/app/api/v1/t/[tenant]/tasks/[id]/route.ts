import { eq } from 'drizzle-orm';
import { tasks } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { loadProject, type ProjectContext, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { deleteTask, getTask, listComments, taskHistory, updateTask } from '@/lib/tasks';

/**
 * GET    — การ์ดพร้อมคอมเมนต์และประวัติ
 * PATCH  — ทุกฟิลด์ยกเว้น column_key และ portal_stage · ปนมาให้ตอบ 400 (กฎข้อ 4)
 * DELETE — เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

/** การ์ดไม่มีรหัสโปรเจกต์ใน URL จึงต้องหาโปรเจกต์แม่ก่อนตัดสินสิทธิ์ (กฎข้อ 10) */
async function projectOfTask(
  tx: Parameters<typeof loadProject>[0],
  ctx: Parameters<typeof loadProject>[1],
  taskId: string,
): Promise<ProjectContext> {
  const rows = await tx
    .select({ projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND');
  return loadProject(tx, ctx, row.projectId);
}

export async function GET(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const p = await projectOfTask(tx, ctx, id);
      const [task, cs, history] = await Promise.all([
        getTask(tx, id),
        listComments(tx, id),
        taskHistory(tx, id),
      ]);
      return { ...task, comments: cs, history, yourAccess: p.access, youArePm: p.isPm };
    });
    return ok(data);
  });
}

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<Record<string, unknown>>(req);
    await inTenant(tenant, async (tx, ctx) => {
      requireProjectWrite(await projectOfTask(tx, ctx, id));
      await updateTask(tx, id, b);
    });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    await inTenant(tenant, async (tx, ctx) => {
      const p = await projectOfTask(tx, ctx, id);
      requireProjectWrite(p);
      // ลบการ์ดเป็นการทำลายของจริง จำกัดที่ PM ของโปรเจกต์กับเจ้าของที่ทำงาน
      if (!p.isPm && ctx.role !== 'owner') {
        throw new ApiError('E_PM_ONLY', 'ลบการ์ดได้เฉพาะ PM ของโปรเจกต์หรือเจ้าของที่ทำงาน');
      }
      await deleteTask(tx, id);
    });
    return ok({ ok: true });
  });
}
