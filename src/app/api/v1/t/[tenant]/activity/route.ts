import { activity, type GroupBy, type Range } from '@/lib/activity';
import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { visibleProjectIds } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';

/**
 * GET — ?range=day|week|month&date=&group=person|project
 *
 * ═══ กฎข้อ 9 ═══
 * **ทุกบทบาทเรียกเส้นนี้เส้นเดียว** ต่างแค่ขอบเขตโปรเจกต์ที่ `resolveAccess()` กรองให้
 * ไม่มีพารามิเตอร์ไหนที่เปิดตัวเลขเพิ่มให้ PM — ถ้ามี หน้านี้จะกลายเป็นเครื่องมือประเมินผลทันที
 *
 * จำนวนดิบไม่ออกจากเซิร์ฟเวอร์เลย ตัดเป็นระดับความเข้ม 0–3 ตั้งแต่ชั้นข้อมูล
 * (ดูเหตุผลเต็มใน `src/lib/activity.ts`)
 */
export const dynamic = 'force-dynamic';

const RANGES: Range[] = ['day', 'week', 'month'];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const q = new URL(req.url).searchParams;
    const rangeRaw = q.get('range') ?? 'day';
    const range: Range = RANGES.includes(rangeRaw as Range) ? (rangeRaw as Range) : 'day';
    const group: GroupBy = q.get('group') === 'project' ? 'project' : 'person';
    const date = q.get('date') ?? undefined;

    const data = await inTenant(tenant, async (tx, ctx) => {
      const projectIds = await visibleProjectIds(tx, ctx);
      return activity(tx, { range, group, date, projectIds });
    });
    return ok(data);
  });
}
