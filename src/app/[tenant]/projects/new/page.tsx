import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { CLIENTS, MEMBERS, TEMPLATES } from '@/mock/data';

/**
 * หน้าจอ 12 · สร้าง / แก้ไขโปรเจกต์
 * รหัสย่อ 3 ตัวสร้างรหัสการ์ด (ACM-138) ใช้อ้างอิงตอนคุยกันในไลน์หรือสแตนด์อัพ
 * ชื่อคอลัมน์ตั้งตั้งแต่ตอนสร้าง เพราะทีมออกแบบกับทีมซอฟต์แวร์เรียกไม่เหมือนกัน
 */
export default async function NewProjectPage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <MockNotice />
      <PageHead title="สร้างโปรเจกต์ใหม่" />
      <div style={{ maxWidth: 640 }}>
        <Card>
          <div className="card-b">
            <div className="fld"><label className="lbl" htmlFor="pn">ชื่อโปรเจกต์</label>
              <input id="pn" className="inp" placeholder="เว็บไซต์ Acme" /></div>

            <div className="row2">
              <div className="fld"><label className="lbl" htmlFor="pk">รหัสย่อ</label>
                <input id="pk" className="inp mn" maxLength={3} placeholder="ACM"
                       style={{ textTransform: 'uppercase' }} />
                <div className="hint">3 ตัวอักษร · ใช้สร้างรหัสการ์ด เช่น ACM-138
                  <br /><b>เปลี่ยนภายหลังไม่ได้</b> เพราะรหัสการ์ดเก่าจะกำพร้า</div></div>
              <div className="fld"><label className="lbl" htmlFor="pc">ลูกค้า</label>
                <select id="pc" className="inp">
                  {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
            </div>

            <div className="fld"><label className="lbl" htmlFor="pm">PM ของโปรเจกต์</label>
              <select id="pm" className="inp">
                {MEMBERS.filter((m) => m.role !== 'guest' && m.role !== 'viewer')
                  .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <div className="hint">PM คือคนเดียวที่ปิดการ์ดได้ · เปลี่ยนได้เฉพาะเจ้าของที่ทำงานหรือ PM คนปัจจุบัน</div></div>

            <div className="fld"><label className="lbl" htmlFor="pt">เริ่มจากแม่แบบ</label>
              <select id="pt" className="inp" defaultValue="tpl-blank">
                {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select></div>

            <div className="fld">
              <span className="lbl">ชื่อคอลัมน์บนบอร์ด</span>
              <div className="row4">
                {['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'].map((c, i) => (
                  <input key={i} className="inp" defaultValue={c} />
                ))}
              </div>
              <div className="hint">จำนวนคอลัมน์คงที่ 4 ช่องเสมอ เปลี่ยนได้แค่ชื่อที่แสดง</div>
            </div>

            <div className="fld" style={{ marginBottom: 16 }}>
              <span className="lbl">ชื่อประเภทงาน</span>
              <div className="row3">
                {['งาน', 'บั๊ก', 'เอกสาร'].map((c, i) => (
                  <input key={i} className="inp" defaultValue={c} />
                ))}
              </div>
              <div className="hint">สูงสุด 3 ค่า — คำว่า “บั๊ก” ใช้ไม่ได้กับงาน HR หรือการตลาด</div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-pri">สร้างโปรเจกต์</button>
              <Link href={`/${tenant}/projects`} className="btn btn-2">ยกเลิก</Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
