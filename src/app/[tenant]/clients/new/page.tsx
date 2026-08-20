import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';

/**
 * เพิ่มลูกค้า — ส่วน CRUD ของหน้าจอ 28 (M3)
 * ผู้ติดต่อของลูกค้าอยู่ตาราง client_contacts ไม่ใช่ users
 * เข้าระบบด้วย magic link เท่านั้น ไม่มีรหัสผ่าน และไม่นับโควตา
 */
export default async function NewClientPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <MockNotice />
      <PageHead title="เพิ่มลูกค้า" />
      <div style={{ maxWidth: 560 }}>
        <Card>
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="cn">
                ชื่อลูกค้า
              </label>
              <input id="cn" className="inp" placeholder="บริษัท แอคมี จำกัด" />
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="ct">
                ชื่อย่อที่ใช้เรียกกันในทีม
              </label>
              <input id="ct" className="inp" placeholder="แอคมี" />
              <div className="hint">ใช้แสดงในรายการโปรเจกต์ ให้สั้นพอที่จะอ่านผ่านตาได้</div>
            </div>

            <div className="fld">
              <label className="lbl" htmlFor="cc">
                ผู้ติดต่อคนแรก (ไม่บังคับ)
              </label>
              <input id="cc" className="inp" placeholder="ชื่อ" style={{ marginBottom: 8 }} />
              <input className="inp mn" placeholder="อีเมล" />
            </div>

            <div className="alert i" style={{ margin: '12px 0' }}>
              <span>ℹ</span>
              <div>
                บัญชีลูกค้าฟรีทุกแผนและไม่นับโควตา · พอร์ทัลจะเปิดให้อัตโนมัติเมื่อโปรเจกต์ ของลูกค้ารายนี้เข้าเฟสประกัน
                ไม่มีสวิตช์แยกให้ลืมเปิด
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-pri">
                บันทึก
              </button>
              <Link href={`/${tenant}/clients`} className="btn btn-2">
                ยกเลิก
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
