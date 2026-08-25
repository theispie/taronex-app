import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ภายใน · TaroNex',
  // หน้าภายในไม่ต้องให้ใครมาเก็บดัชนี
  robots: { index: false, follow: false },
};

/**
 * เปลือกของหน้าภายใน — แถบดำบนสุดมีไว้ให้แยกออกจากหน้าจริงตั้งแต่แวบแรก
 *
 * ⚠ ยังไม่มีการยืนยันตัวตน — เดิมเขียนว่า "เพราะยังไม่มีฐานข้อมูล" ซึ่งไม่จริงแล้ว
 * ตอนนี้มีฐานข้อมูลจริงแล้ว **ก่อนรับลูกค้าจริงต้องปิด /internal ทั้งชุด**
 * ด้วย basic auth ที่ nginx หรือผูกกับเซสชันของเจ้าของที่ทำงาน
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ibar">
        <span>●</span>
        <b>หน้าภายใน</b>
        <span style={{ color: '#B9BDD0' }}>ไม่ใช่หน้าที่ลูกค้าเห็น</span>
        <Link href="/internal/api" style={{ color: 'inherit' }}>
          API
        </Link>
        <Link href="/internal/db" style={{ color: 'inherit' }}>
          ฐานข้อมูล
        </Link>
        <div className="r">
          <span>ยังไม่มีการยืนยันตัวตน</span>
        </div>
      </div>
      {children}
    </>
  );
}
