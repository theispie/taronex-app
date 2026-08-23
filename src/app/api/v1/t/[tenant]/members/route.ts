import { and, count, eq, isNull } from 'drizzle-orm';
import { memberships, projects, tasks, users } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';

/**
 * GET /api/v1/t/{tenant}/members — รายชื่อสมาชิก + จำนวนการ์ดที่ถือ + เป็น PM ของอะไร
 *
 * กฎข้อ 9: ตัวเลข "ถืออยู่" เป็นบริบท ไม่ใช่คะแนน
 * ห้ามเพิ่มตัวเลขที่เอามาเรียงลำดับคนได้ และห้ามมีตัวเลขที่ PM เห็นแต่คนอื่นไม่เห็น
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  try {
    const { tenant } = await params;
    const data = await inTenant(tenant, async (tx) => {
      const rows = await tx
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          role: memberships.role,
          jobTitle: memberships.jobTitle,
          active: memberships.deactivatedAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId));

      // นับการ์ดที่ถืออยู่ทีเดียวทั้งที่ทำงาน แล้วค่อยแมป ไม่ยิงทีละคน
      const held = await tx
        .select({ assigneeId: tasks.assigneeId, n: count() })
        .from(tasks)
        .groupBy(tasks.assigneeId);
      const heldBy = new Map(held.map((h) => [h.assigneeId, h.n]));

      const pmOf = await tx
        .select({ pmUserId: projects.pmUserId, key: projects.key })
        .from(projects)
        .where(eq(projects.isArchived, false));

      return rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        email: r.email,
        role: r.role,
        jobTitle: r.jobTitle,
        active: r.active === null,
        holding: heldBy.get(r.userId) ?? 0,
        pmOf: pmOf.filter((p) => p.pmUserId === r.userId).map((p) => p.key),
      }));
    });
    return ok(data, { page: 1, total: data.length });
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}
