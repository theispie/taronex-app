import { eq } from 'drizzle-orm';
import { clients, warrantyContracts } from '@/db/schema';
import { inTenant, requireWriter } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { body, handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { clientContract, type Priority, saveContract } from '@/lib/sla';

/**
 * GET — สัญญาประกันของลูกค้ารายนี้ + นโยบาย SLA เวอร์ชันปัจจุบัน
 * PUT — บันทึกเป็น**เวอร์ชันใหม่** ไม่ทับของเดิม
 *
 * เรื่องที่เปิดนาฬิกาไว้แล้วยังใช้เวลาเป้าหมายเดิม เพราะ `sla_clocks`
 * คัดลอกตัวเลขมาเก็บตอนสร้าง ไม่ได้ join กลับมาที่นโยบายตอนอ่าน
 */
export const dynamic = 'force-dynamic';

interface Patch {
  countBusinessHours?: boolean;
  pauseOnCustomer?: boolean;
  pauseOnVendor?: boolean;
  levels?: Partial<Record<Priority, { respond: number; resolve: number }>>;
  contract?: { projectId: string; endsOn?: string; scopeText?: string; renewNoticeDays?: number };
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const data = await inTenant(tenant, async (tx) => {
      await mustExist(tx, id);
      return clientContract(tx, id);
    });
    return ok(data);
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const b = await body<Patch>(req);

    for (const p of PRIORITIES) {
      const lv = b.levels?.[p];
      if (!lv) continue;
      if (!Number.isInteger(lv.respond) || lv.respond < 1) {
        throw new ApiError('E_INVALID', 'เวลาตอบรับต้องเป็นจำนวนนาทีที่มากกว่าศูนย์', `levels.${p}`);
      }
      if (!Number.isInteger(lv.resolve) || lv.resolve < lv.respond) {
        throw new ApiError('E_INVALID', 'เวลาแก้เสร็จต้องไม่น้อยกว่าเวลาตอบรับ', `levels.${p}`);
      }
    }

    const data = await inTenant(tenant, async (tx, ctx) => {
      requireWriter(ctx);
      await mustExist(tx, id);
      await saveContract(tx, ctx.tenantId, id, b);

      // แก้ขอบเขต/วันสิ้นสุดของสัญญาโปรเจกต์เดียว ถ้าส่งมาด้วย
      if (b.contract?.projectId) {
        const patch: Record<string, unknown> = {};
        if (b.contract.endsOn) patch.endsOn = b.contract.endsOn;
        if (b.contract.scopeText !== undefined) patch.scopeText = b.contract.scopeText;
        if (b.contract.renewNoticeDays !== undefined) {
          patch.renewNoticeDays = b.contract.renewNoticeDays;
        }
        if (Object.keys(patch).length > 0) {
          await tx
            .update(warrantyContracts)
            .set(patch)
            .where(eq(warrantyContracts.projectId, b.contract.projectId));
        }
      }
      return clientContract(tx, id);
    });
    return ok(data);
  });
}

async function mustExist(tx: Parameters<typeof clientContract>[0], clientId: string) {
  const rows = await tx
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
}
