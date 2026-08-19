import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';

/**
 * หน้าจอ 09 · เชิญสมาชิก
 * ใส่หลายอีเมลพร้อมกันได้ เพราะเวลาเปิดทีมใหม่มักเชิญทีเดียวหลายคน
 * โควตาที่นั่งบอกตรงนี้ ไม่ใช่ให้ไปเจอตอนกดส่งแล้วเด้ง error
 */
export default async function InviteMembersPage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <MockNotice />
      <PageHead title="เชิญสมาชิก" desc="เหลือที่นั่ง 10 จาก 15" />
      <div style={{ maxWidth: 560 }}>
        <Card>
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="ems">อีเมล</label>
              <textarea id="ems" className="inp mn" rows={4}
                placeholder={'bee@digitalx.co.th\nkorn@digitalx.co.th'} />
              <div className="hint">ใส่ได้หลายอีเมล บรรทัดละหนึ่งคน</div>
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="rl">สิทธิ์</label>
              <select id="rl" className="inp" defaultValue="member">
                <option value="member">สมาชิก — ร่วมงานได้ทุกโปรเจกต์</option>
                <option value="viewer">ผู้ชม — เห็นทุกอย่างแต่แก้ไม่ได้</option>
                <option value="owner">เจ้าของ — จัดการที่ทำงานได้</option>
              </select>
            </div>
            <div className="fld" style={{ marginBottom: 16 }}>
              <label className="lbl" htmlFor="jt">ตำแหน่งงาน</label>
              <select id="jt" className="inp" defaultValue="dev">
                <option value="pm">PM</option><option value="ba">BA</option>
                <option value="dev">Dev</option><option value="qa">QA</option>
                <option value="design">Design</option><option value="other">อื่นๆ</option>
              </select>
              <div className="hint">ตำแหน่งงานใช้แสดงผลและกรองงานเท่านั้น ไม่เปลี่ยนสิทธิ์</div>
            </div>
            <div className="alert i" style={{ marginBottom: 14 }}>
              <span>ℹ</span><div>คนที่เข้ามาใหม่จะเห็นทุกโปรเจกต์ในที่ทำงานนี้
                ถ้าต้องการจำกัดให้ตั้งค่าที่หน้าสิทธิ์ของแต่ละโปรเจกต์</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-pri">ส่งคำเชิญ</button>
              <Link href={`/${tenant}/settings/members`} className="btn btn-2">ยกเลิก</Link>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              คำเชิญมีอายุ 7 วัน · เชิญซ้ำอีเมลเดิมจะทำให้ลิงก์เดิมเป็นโมฆะและส่งใหม่</div>
          </div>
        </Card>
      </div>
    </>
  );
}
