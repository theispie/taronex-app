import { Card, MockNotice, PageHead } from '@/components/ui';
import { WARRANTY_TASKS } from '@/mock/data';
import type { WarrantyScope } from '@/lib/types';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 33 · ศูนย์งานประกัน / SLA
 * เรียงตามเวลาที่เหลือ ไม่ใช่ตามวันที่แจ้ง — สิ่งที่ต้องตัดสินใจคือ "ทำอะไรก่อน"
 * "เกินมา 3 ชม." ตรงกว่า "ละเมิด SLA" ซึ่งฟังเหมือนกล่าวโทษคนในทีม
 */
const SCOPE: Record<WarrantyScope, { label: string; cls: string }> = {
  pending: { label: 'รอคัดแยก', cls: 'st-todo' },
  covered: { label: 'อยู่ในประกัน', cls: 'st-done' },
  billable: { label: 'งานเพิ่ม', cls: 'st-doing' },
  not_ours: { label: 'ไม่เกี่ยวกับเรา', cls: '' },
};

export default function SlaPage() {
  return (
    <>
      <MockNotice />
      <PageHead
        title="ศูนย์งานประกัน / SLA"
        desc="เรียงตามเวลาที่เหลือ"
        right={<button type="button" className="btn btn-2 btn-sm">คิวคัดแยก 2</button>}
      />
      <Card>
        <table className="tbl">
          <thead>
            <tr>
              <th>รหัส</th><th>เรื่อง</th><th>ลูกค้า</th>
              <th>การคัดแยก</th><th>นาฬิกา</th>
            </tr>
          </thead>
          <tbody>
            {WARRANTY_TASKS.map((t) => {
              const sc = SCOPE[t.warrantyScope ?? 'pending'];
              return (
                <tr key={t.id}>
                  <td><span className="cd mn">{taskCode(t)}</span></td>
                  <td style={{ fontWeight: 500 }}>{t.title}</td>
                  <td className="sub">ทองไทย มีเดีย</td>
                  <td><span className={`chip ${sc.cls}`}>{sc.label}</span></td>
                  <td>
                    {t.warrantyScope === 'covered' ? (
                      <span className="pr pr-critical">เกินมา 3 ชม.</span>
                    ) : (
                      <span className="sub">ยังไม่เริ่มเดิน</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>นาฬิกายังไม่เดินจนกว่าจะคัดแยกเสร็จ — เวลาจะได้ไม่ถูกกินไปกับการตัดสินใจภายใน</div>
      </div>
    </>
  );
}
