import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { CURRENT_USER, MEMBERS } from '@/mock/data';

/**
 * หน้าจอ 10 · โปรไฟล์ผู้ใช้ (ในที่ทำงานนี้)
 * ตำแหน่งงานแก้เองได้ เพราะมันไม่ใช่สิทธิ์ ถ้าเป็นสิทธิ์ต้องให้เจ้าของแก้เท่านั้น
 * บอกตรงๆ ว่าเวอร์ชันนี้ส่งอีเมลแค่สามข้อแรก
 */
const MAILS = [
  { label: 'มีคนมอบหมายงานให้ฉัน', on: true },
  { label: 'งานของฉันถูกตีกลับ', on: true },
  { label: 'มีคนพูดถึงฉันในคอมเมนต์', on: true },
  { label: 'สรุปงานประจำวัน', on: false, soon: true },
  { label: 'งานประกันใกล้ครบกำหนด', on: false, soon: true },
];

export default function MePage() {
  const me = MEMBERS.find((m) => m.id === CURRENT_USER.id);
  return (
    <>
      <MockNotice />
      <PageHead title="โปรไฟล์ของฉัน" desc="เฉพาะในที่ทำงานนี้" />
      <div className="grid2">
        <Card>
          <div className="card-h">
            <Avatar member={me} size="lg" />
            <div>
              <b>{CURRENT_USER.name}</b>
              <div className="mn sub" style={{ fontSize: 11.5 }}>
                {CURRENT_USER.email}
              </div>
            </div>
          </div>
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="mj">
                ตำแหน่งงาน
              </label>
              <select id="mj" className="inp" defaultValue="pm">
                <option value="pm">PM</option>
                <option value="ba">BA</option>
                <option value="dev">Dev</option>
                <option value="qa">QA</option>
                <option value="design">Design</option>
                <option value="other">อื่นๆ</option>
              </select>
              <div className="hint">แก้เองได้ เพราะตำแหน่งงานไม่ใช่สิทธิ์</div>
            </div>
            <div className="kv">
              <span>สิทธิ์ในที่ทำงานนี้</span>
              <span className="chip st-review">เจ้าของ</span>
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              สิทธิ์เปลี่ยนได้โดยเจ้าของที่ทำงานเท่านั้น
            </div>
            <button type="button" className="btn btn-pri" style={{ marginTop: 12 }}>
              บันทึก
            </button>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>อีเมลที่ระบบส่งหาคุณ</b>
          </div>
          <div className="card-b">
            {MAILS.map((m) => (
              <label key={m.label} className="chkrow">
                <input type="checkbox" defaultChecked={m.on} disabled={m.soon} />
                <span style={{ opacity: m.soon ? 0.5 : 1 }}>{m.label}</span>
                {m.soon ? <span className="soon-badge">v3</span> : null}
              </label>
            ))}
            <div className="hint" style={{ marginTop: 10 }}>
              เวอร์ชันนี้ส่งจริงแค่สามข้อแรก — บอกตรงๆ ดีกว่าโชว์ตัวเลือกที่กดแล้วไม่เกิดอะไร
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
