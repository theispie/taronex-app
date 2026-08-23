import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { memberships, projects, tenants } from '@/db/schema';
import { inTenant, requireOwner } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { fail, ok } from '@/lib/api/respond';

/**
 * GET  /api/v1/t/{tenant}/workspace — ข้อมูลที่ทำงาน + โควตาที่ใช้ไป
 * PATCH /api/v1/t/{tenant}/workspace — เจ้าของเท่านั้น
 *
 * เป็น endpoint จริงตัวแรกที่เดินครบทั้งเส้น:
 *   คุกกี้ → ตรวจ memberships → RLS → resolveAccess → serializer
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ tenant: string }> };

export async function GET(_req: Request, { params }: Params): Promise<Response> {
  try {
    const { tenant } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const rows = await tx
        .select({
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.plan,
          status: tenants.status,
          timezone: tenants.timezone,
          businessHours: tenants.businessHours,
        })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      const ws = rows[0];
      if (!ws) throw new ApiError('E_NOT_FOUND');

      // โควตานับเฉพาะโปรเจกต์ที่ยังไม่ปิด และสมาชิกที่ยังใช้งานอยู่
      const [openProjects] = await tx
        .select({ n: count() })
        .from(projects)
        .where(eq(projects.isArchived, false));
      const [seats] = await tx
        .select({ n: count() })
        .from(memberships)
        .where(isNull(memberships.deactivatedAt));

      return {
        ...ws,
        yourRole: ctx.role,
        usage: { projects: openProjects?.n ?? 0, seats: seats?.n ?? 0 },
      };
    });
    return ok(data);
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  try {
    const { tenant } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      timezone?: unknown;
    };

    const data = await inTenant(tenant, async (tx, ctx) => {
      requireOwner(ctx);
      const patch: Record<string, string> = {};
      if (typeof body.name === 'string' && body.name.trim() !== '') patch.name = body.name.trim();
      if (typeof body.timezone === 'string' && body.timezone.trim() !== '') {
        patch.timezone = body.timezone.trim();
      }
      if (Object.keys(patch).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

      const rows = await tx
        .update(tenants)
        .set(patch)
        .where(eq(tenants.id, ctx.tenantId))
        .returning({ name: tenants.name, timezone: tenants.timezone });
      return rows[0];
    });
    return ok(data);
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}
