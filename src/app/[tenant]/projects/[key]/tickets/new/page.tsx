import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS, projectByKey } from '@/mock/data';

/**
 * หน้าจอ 21 · สร้างทิกเก็ต
 * "วันเริ่ม" ไม่บังคับ ถ้าไม่ใส่ Timeline จะใช้กำหนดส่งเป็นจุดอ้างอิงแทน
 * "สร้างต่ออีกใบ" ติ๊กไว้เป็นค่าเริ่มต้น เพราะคนมักแตกงานหลายใบรวดเดียวหลังประชุม
 * การ์ดใหม่เข้า todo เสมอ — POST /projects/:id/tasks ไม่รับพารามิเตอร์ status
 */
export default async function NewTicketPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  return (
    <>
      <MockNotice />
      <PageHead title="สร้างการ์ดใหม่" desc={`${p.name} · ${p.key}`} />
      <div style={{ maxWidth: 620 }}>
        <Card><div className="card-b">
          <div className="fld"><label className="lbl" htmlFor="tt">ชื่อการ์ด</label>
            <input id="tt" className="inp" placeholder="แก้บั๊กตะกร้าคำนวณส่วนลดผิด" /></div>

          <div className="fld"><label className="lbl" htmlFor="td">รายละเอียด</label>
            <textarea id="td" className="inp" rows={4}
              placeholder="ทำอะไร ให้ถือว่าเสร็จเมื่อไร และมีอะไรที่ต้องระวัง" />
            <div className="hint">เขียนให้คนอื่นหยิบไปทำแทนได้โดยไม่ต้องถาม</div></div>

          <div className="row2">
            <div className="fld"><label className="lbl" htmlFor="tf">งานหลัก</label>
              <select id="tf" className="inp">
                <option value="">— งานนอกแผน —</option>
                {p.features.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select></div>
            <div className="fld"><label className="lbl" htmlFor="ty">ประเภท</label>
              <select id="ty" className="inp">
                {p.typeLabels.map((x) => <option key={x}>{x}</option>)}
              </select></div>
          </div>

          <div className="row2">
            <div className="fld"><label className="lbl" htmlFor="ta">ผู้รับผิดชอบ</label>
              <select id="ta" className="inp">
                <option value="">— ยังไม่กำหนด —</option>
                {MEMBERS.filter((m) => m.role === 'member' || m.role === 'owner')
                  .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select></div>
            <div className="fld"><label className="lbl" htmlFor="tp">ความสำคัญ</label>
              <select id="tp" className="inp" defaultValue="medium">
                <option value="low">ต่ำ</option><option value="medium">กลาง</option>
                <option value="high">สูง</option><option value="critical">วิกฤต</option>
              </select></div>
          </div>

          <div className="row2">
            <div className="fld"><label className="lbl" htmlFor="ts">วันเริ่ม (ไม่บังคับ)</label>
              <input id="ts" className="inp mn" type="date" />
              <div className="hint">ไม่ใส่ก็ได้ — Timeline จะใช้กำหนดส่งแทน</div></div>
            <div className="fld"><label className="lbl" htmlFor="tdd">กำหนดส่ง</label>
              <input id="tdd" className="inp mn" type="date" /></div>
          </div>

          <label className="chkrow" style={{ borderBottom: 0 }}>
            <input type="checkbox" defaultChecked /> <span>สร้างต่ออีกใบหลังบันทึก</span>
          </label>

          <div className="alert i" style={{ margin: '12px 0' }}>
            <span>ℹ</span><div>การ์ดใหม่เข้าคอลัมน์ “{p.columnLabels[0]}” เสมอ
              — เลือกสถานะตอนสร้างไม่ได้</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-pri">สร้างการ์ด</button>
            <Link href={`/${tenant}/projects/${key}/board`} className="btn btn-2">ยกเลิก</Link>
          </div>
        </div></Card>
      </div>
    </>
  );
}
