import { count, eq, isNull } from 'drizzle-orm';
import { memberships, projects, tenants } from '@/db/schema';
import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { PLANS, planOf } from '@/lib/plans';

/**
 * GET /api/v1/t/{tenant}/plans — แผนและโควตา + ที่ใช้ไปแล้ว
 *
 * กฎข้อ 7 — ไม่มีเส้นทางไหนในโมดูลนี้ที่ลบข้อมูลผู้ใช้
 * เกินโควตา ลดแผน ค้างชำระ ระงับบัญชี ล้วนปิดการเข้าถึงเท่านั้น
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const data = await inTenant(tenant, async (tx, ctx) => {
      const [openProjects] = await tx
        .select({ n: count() })
        .from(projects)
        .where(eq(projects.isArchived, false));
      const [seats] = await tx
        .select({ n: count() })
        .from(memberships)
        .where(isNull(memberships.deactivatedAt));
      const rows = await tx
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      const current = rows[0]?.plan ?? 'free';
      return {
        current,
        plans: PLANS,
        usage: { projects: openProjects?.n ?? 0, seats: seats?.n ?? 0 },
        limits: { projects: planOf(current).projects, seats: planOf(current).seats },
        note: 'เกินโควตาปิดแค่การเปิดของใหม่ ข้อมูลเดิมไม่ถูกลบในทุกกรณี',
      };
    });
    return ok(data);
  });
}
