import { Card, MockNotice, PageHead } from '@/components/ui';
import { WARRANTY_TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 38 · คิวคัดแยกเรื่องที่ลูกค้าแจ้ง
 * จุดที่เอเจนซี่เสียเงินมากที่สุดในสัญญา MA — ลูกค้าแจ้ง "บั๊ก" ที่จริงคืองานใหม่
 * แล้วไม่มีใครกล้าปฏิเสธเพราะไม่มีหลักฐาน
 * นาฬิกา SLA ยังไม่เดินจนกว่าจะคัดแยกเสร็จ ไม่งั้นเวลาจะถูกกินไปกับการตัดสินใจภายใน
 * "ไม่เกี่ยวกับเรา" ตรงกว่า "นอกขอบเขต" และไม่ฟังเหมือนโยนความผิด
 */
export default function TriagePage() {
  const pending = WARRANTY_TASKS.filter((t) => t.warrantyScope === 'pending');
  return (
    <>
      <MockNotice />
      <PageHead title="คิวคัดแยก" desc={`${pending.length} เรื่องรอคัดแยก · นาฬิกายังไม่เริ่มเดิน`} />
      <div style={{ display: 'grid', gap: 12 }}>
        {pending.map((t) => (
          <Card key={t.id}>
            <div className="card-h">
              <span className="cd mn">{taskCode(t)}</span>
              <b>{t.title}</b>
              <div className="r"><span className="sub">ทองไทย มีเดีย · แจ้งเมื่อ {t.heldDays} วันก่อน</span></div>
            </div>
            <div className="card-b">
              <p className="sub" style={{ marginBottom: 12 }}>
                ลูกค้าเลือกระดับผลกระทบ: <span className="chip">ทำงานต่อไม่ได้</span>{' '}
                <span className="hint">(ระดับที่ทีมตั้งจริงอาจต่างจากนี้)</span>
              </p>
              <div className="triage">
                <button type="button" className="btn btn-2 tri">
                  <b>อยู่ในประกัน</b><span>เราทำให้ฟรีตามสัญญา · เริ่มเดินนาฬิกา</span></button>
                <button type="button" className="btn btn-2 tri">
                  <b>งานเพิ่ม ฿</b><span>ไม่ได้อยู่ในขอบเขตเดิม ต้องเสนอราคาก่อน</span></button>
                <button type="button" className="btn btn-2 tri">
                  <b>ไม่เกี่ยวกับเรา</b><span>เกิดจากระบบอื่นหรือผู้ให้บริการภายนอก</span></button>
              </div>
            </div>
          </Card>
        ))}
        {pending.length === 0 ? (
          <Card><div className="empty">คัดแยกครบแล้ว</div></Card>
        ) : null}
      </div>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>นาฬิกา SLA สร้างเมื่อคัดแยกเป็น “อยู่ในประกัน” เท่านั้น —
          เวลาที่ใช้ตัดสินใจภายในไม่ถูกนับเป็นเวลาของลูกค้า</div>
      </div>
    </>
  );
}
