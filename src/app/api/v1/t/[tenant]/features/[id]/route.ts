import { eq } from 'drizzle-orm';
import { features } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { deleteFeature, updateFeature } from '@/lib/projects';

/**
 * PATCH/DELETE /api/v1/t/{tenant}/features/{id}
 *
 * ลบงานหลักแล้ว **การ์ดลูกต้องไม่ถูกลบ** กลายเป็นงานนอกแผนแทน
 * มีเทสต์นับการ์ดก่อนและหลังคอยจับไว้
 */
export const dynamic = 'force-dynamic';
type P = { params: Promise<{ tenant: string; id: string }> };

/** งานหลักไม่มีรหัสโปรเจกต์ใน URL จึงต้องหาโปรเจกต์แม่ก่อนตัดสินสิทธิ์ (กฎข้อ 10) */
async function ownerProjectOf(
  tx: Parameters<typeof loadProject>[0],
  ctx: Parameters<typeof loadProject>[1],
  featureId: string,
) {
  const rows = await tx
    .select({ projectId: features.projectId })
    .from(features)
    .where(eq(features.id, featureId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND');
  return loadProject(tx, ctx, row.projectId);
}

export async function PATCH(req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<{ name: string; color: string; position: number }>(req);
    await inTenant(tenant, async (tx, ctx) => {
      requireProjectWrite(await ownerProjectOf(tx, ctx, id));
      await updateFeature(tx, id, b);
    });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: P): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const r = await inTenant(tenant, async (tx, ctx) => {
      requireProjectWrite(await ownerProjectOf(tx, ctx, id));
      return deleteFeature(tx, id);
    });
    return ok(r);
  });
}
