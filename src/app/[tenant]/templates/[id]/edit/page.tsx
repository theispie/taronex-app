import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { templateById } from '@/mock/data';

/**
 * หน้าจอ 41 · สร้าง / แก้ไขแม่แบบ
 * ประเภทงานตั้งชื่อเองได้สูงสุด 3 ค่า — เพราะคำว่า "บั๊ก" ใช้ไม่ได้กับงาน HR หรือการตลาด
 * การ์ดตั้งต้นใช้วันสัมพัทธ์ (+3 วันจากวันเริ่ม) ไม่ใช่วันจริง จึงใช้ซ้ำได้ทุกโปรเจกต์
 * จำนวนคอลัมน์ยังคงที่ 4 ช่องแม้ในแม่แบบ — ถ้าเปิดตรงนี้ ทุกอย่างที่ผูกกับสถานะจะพังตามหมด
 */
export default async function TemplateEditPage({
  params,
}: { params: Promise<{ tenant: string; id: string }> }) {
  const { id } = await params;
  const t = templateById(id);
  if (!t) notFound();
  return (
    <>
      <MockNotice />
      <PageHead title={`แม่แบบ: ${t.name}`}
                right={<button type="button" className="btn btn-pri btn-sm">บันทึก</button>} />
      <div style={{ maxWidth: 680 }}>
        <Card className="mb">
          <div className="card-b">
            <div className="fld"><label className="lbl" htmlFor="tn">ชื่อแม่แบบ</label>
              <input id="tn" className="inp" defaultValue={t.name} /></div>
            <div className="fld">
              <span className="lbl">ชื่อคอลัมน์ (คงที่ 4 ช่อง)</span>
              <div className="row4">{t.columns.map((c, i) => <input key={i} className="inp" defaultValue={c} />)}</div>
              <div className="hint">เปิดให้เพิ่มคอลัมน์ไม่ได้ — ทุกอย่างที่ผูกกับสถานะจะพังตามหมด</div>
            </div>
            <div className="fld" style={{ marginBottom: 0 }}>
              <span className="lbl">ประเภทงาน (สูงสุด 3)</span>
              <div className="row3">{[0, 1, 2].map((i) =>
                <input key={i} className="inp" defaultValue={t.types[i] ?? ''} />)}</div>
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h"><b>งานหลักตั้งต้น</b>
            <div className="r"><button type="button" className="btn btn-2 btn-sm">＋ เพิ่ม</button></div></div>
          {t.features.map((f, i) => (
            <div key={f} className="row">
              <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
              <span className="row-title">{f}</span>
              <span className="sub mn">+{i * 5} วันจากวันเริ่ม</span>
            </div>
          ))}
          {t.features.length === 0 ? <div className="empty">แม่แบบนี้เริ่มจากบอร์ดเปล่า</div> : null}
        </Card>

        <div className="alert i">
          <span>ℹ</span>
          <div>ยังไม่มีฟิลด์เพิ่มเติมที่ตั้งเองได้ — จะเปิดเมื่อมีคนขอเกิน 3 ทีมที่ใช้งานจริง
            ไม่ใช่ลืม แต่ตั้งใจรอ</div>
        </div>
      </div>
    </>
  );
}
