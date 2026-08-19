import Link from 'next/link';

/**
 * หน้าจอ 30 · พอร์ทัล — หน้าแรก
 * แยกเป็นสองกลุ่มพอ: กำลังดำเนินการ กับ แก้ไขแล้ว
 * ลูกค้าไม่ต้องรู้จักคอลัมน์ทั้งสี่ของทีม
 * ใช้คำว่า "แจ้งปัญหา" ไม่ใช่ "สร้างทิกเก็ต" · "กำลังแก้ไข" ไม่ใช่ "กำลังทำ"
 */
const OPEN = [
  { code: 'TT-026', title: 'ฟอร์มติดต่อส่งอีเมลไม่ออก', step: 'กำลังแก้ไข', date: '18 ส.ค. 2569' },
  { code: 'TT-028', title: 'รูปหน้าแรกโหลดช้ามาก', step: 'กำลังตรวจสอบ', date: '19 ส.ค. 2569' },
];
const CLOSED = [
  { code: 'TT-024', title: 'ลิงก์เมนูสินค้าเสีย', step: 'แก้ไขแล้ว', date: '02 ส.ค. 2569' },
  { code: 'TT-023', title: 'ขอเปลี่ยนเบอร์โทรหน้าติดต่อ', step: 'แก้ไขแล้ว', date: '28 ก.ค. 2569' },
];

export default async function PortalHome({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <>
      <div className="pw-head">
        <div>
          <h1>เรื่องที่แจ้งไว้</h1>
          <p className="sub">ติดตามสถานะได้ที่นี่ ไม่ต้องโทรถาม</p>
        </div>
        <Link href={`/portal/${slug}/new`} className="btn btn-ws btn-lg">＋ แจ้งปัญหา</Link>
      </div>

      <h2 className="pw-h2">กำลังดำเนินการ</h2>
      <div className="pw-card mb">
        {OPEN.map((x) => (
          <Link key={x.code} href={`/portal/${slug}/i/${x.code}`} className="pw-row">
            <span className="mn pw-code">{x.code}</span>
            <span className="pw-title">{x.title}</span>
            <span className="chip" style={{ background: 'var(--ws-50)', color: 'var(--ws-700)' }}>
              {x.step}</span>
            <span className="sub mn">{x.date}</span>
          </Link>
        ))}
      </div>

      <h2 className="pw-h2">แก้ไขแล้ว</h2>
      <div className="pw-card">
        {CLOSED.map((x) => (
          <Link key={x.code} href={`/portal/${slug}/i/${x.code}`} className="pw-row">
            <span className="mn pw-code">{x.code}</span>
            <span className="pw-title">{x.title}</span>
            <span className="chip st-done">{x.step}</span>
            <span className="sub mn">{x.date}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
