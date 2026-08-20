import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { clientById } from '@/mock/data';

/**
 * หน้าจอ 29 · เชิญคนของลูกค้า
 * ปุ่มใช้สีเขียวมิ้นต์ของฝั่งลูกค้า ไม่ใช่สีม่วงของทีมภายใน — ย้ำว่ากำลังทำอะไรกับใคร
 * บอกชัดว่าลูกค้าไม่เห็นอะไรบ้าง ก่อนกดส่ง ไม่ใช่ให้ไปเดาเอง
 * client_contacts ไม่ใช่ users · เข้าด้วย magic link เท่านั้น ไม่มีรหัสผ่าน ไม่นับโควตา
 */
const CONTACTS = [
  { name: 'คุณสมหญิง', email: 'somying@thongthai.co.th', last: 'เมื่อวาน' },
  { name: 'คุณวิชัย', email: 'wichai@thongthai.co.th', last: 'ยังไม่เคยเข้า' },
];

export default async function ClientPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant, id } = await params;
  const c = clientById(id);
  if (!c) notFound();
  return (
    <>
      <MockNotice />
      <PageHead
        title={c.name}
        desc={`${c.projects} โปรเจกต์ · ${c.contacts} ผู้ติดต่อ`}
        right={
          c.portalEnabled ? (
            <Link href={`/${tenant}/clients/${id}/contract`} className="btn btn-2 btn-sm">
              สัญญาและ SLA
            </Link>
          ) : null
        }
      />
      <div className="grid2">
        <Card>
          <div className="card-h">
            <b>ผู้ติดต่อ</b>
            <div className="r">
              <span className="chip st-done">ไม่นับโควตา</span>
            </div>
          </div>
          {CONTACTS.map((p) => (
            <div key={p.email} className="row">
              <span className="row-title">{p.name}</span>
              <span className="mn sub">{p.email}</span>
              <span className="sub">{p.last}</span>
            </div>
          ))}
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="ce">
                เชิญผู้ติดต่อใหม่
              </label>
              <input id="ce" className="inp mn" placeholder="name@client.co.th" />
            </div>
            <button type="button" className="btn btn-ws">
              ส่งคำเชิญเข้าพอร์ทัล
            </button>
            <div className="hint" style={{ marginTop: 8 }}>
              บัญชีลูกค้าฟรีทุกแผน · เข้าด้วยลิงก์ทางอีเมล ไม่ต้องตั้งรหัสผ่าน
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>ลูกค้าเห็นอะไรบ้าง</b>
          </div>
          <div className="card-b">
            <div className="seen">
              <span className="ok">✓</span> เรื่องที่ตัวเองแจ้ง และสถานะเป็นขั้นๆ
            </div>
            <div className="seen">
              <span className="ok">✓</span> วันที่ของแต่ละขั้น (ไม่มีเวลา)
            </div>
            <div className="seen">
              <span className="no">✕</span> ชื่อผู้รับผิดชอบ
            </div>
            <div className="seen">
              <span className="no">✕</span> ความสำคัญที่ทีมตั้ง
            </div>
            <div className="seen">
              <span className="no">✕</span> ตัวเลข SLA ทุกชนิด
            </div>
            <div className="seen">
              <span className="no">✕</span> คอมเมนต์ภายในของทีม
            </div>
            <div className="seen">
              <span className="no">✕</span> โปรเจกต์อื่นและลูกค้ารายอื่น
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              พอร์ทัลใช้ตัวแปลงข้อมูลคนละชุดกับฝั่งทีม ไม่ใช่แค่ซ่อนในหน้าเว็บ
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
