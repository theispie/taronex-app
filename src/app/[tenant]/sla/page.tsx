import { Card, MockNotice } from '@/components/ui';
import { WARRANTY_TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 33 · ศูนย์งานประกัน / SLA
 * เรียงตามเวลาที่เหลือ ไม่ใช่ตามวันที่แจ้ง — สิ่งที่ต้องตัดสินใจคือ "ทำอะไรก่อน"
 * นาฬิกาเดินเฉพาะเรื่องที่คัดแยกแล้วเป็น covered
 */
export default function SlaPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <MockNotice />
      <h1 className="mb-1 text-xl font-semibold text-ink">ศูนย์งานประกัน / SLA</h1>
      <p className="mb-6 text-sm text-muted">เรียงตามเวลาที่เหลือ</p>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">รหัส</th>
              <th className="px-4 py-2 font-medium">เรื่อง</th>
              <th className="px-4 py-2 font-medium">การคัดแยก</th>
              <th className="px-4 py-2 font-medium">นาฬิกา</th>
            </tr>
          </thead>
          <tbody>
            {WARRANTY_TASKS.map((t) => (
              <tr key={t.id} className="border-b border-line-2 last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-brand">{taskCode(t)}</td>
                <td className="px-4 py-2.5 text-ink">{t.title}</td>
                <td className="px-4 py-2.5">
                  <ScopeBadge scope={t.warrantyScope} />
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {t.warrantyScope === 'covered' ? (
                    <span className="font-medium text-danger">เกินมา 3 ชม.</span>
                  ) : (
                    <span className="text-muted">ยังไม่เริ่มเดิน</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-muted">
        นาฬิกายังไม่เดินจนกว่าจะคัดแยกเสร็จ — เวลาจะได้ไม่ถูกกินไปกับการตัดสินใจภายใน
      </p>
    </div>
  );
}

function ScopeBadge({ scope }: { scope?: string }) {
  const map: Record<string, [string, string]> = {
    pending: ['รอคัดแยก', 'bg-todo-bg text-todo'],
    covered: ['อยู่ในประกัน', 'bg-done-bg text-done'],
    billable: ['งานเพิ่ม', 'bg-warn-bg text-warn'],
    not_ours: ['ไม่เกี่ยวกับเรา', 'bg-line-2 text-muted'],
  };
  const [label, cls] = map[scope ?? 'pending'] ?? map.pending!;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
