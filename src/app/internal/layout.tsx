import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ภายใน · TaroNex',
  // หน้าภายในไม่ต้องให้ใครมาเก็บดัชนี
  robots: { index: false, follow: false },
};

/**
 * เปลือกของหน้าภายใน — แถบดำบนสุดมีไว้ให้แยกออกจากหน้าจริงตั้งแต่แวบแรก
 *
 * ตอนนี้ยังไม่มีการยืนยันตัวตน เพราะยังไม่มีฐานข้อมูล
 * ก่อนขึ้นใช้จริงต้องปิดด้วยอย่างใดอย่างหนึ่ง — ดูหมายเหตุในหน้า
 */
export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="ibar">
        <span>●</span>
        <b>หน้าภายใน</b>
        <span style={{ color: '#B9BDD0' }}>ไม่ใช่หน้าที่ลูกค้าเห็น</span>
        <div className="r">
          <span>ยังไม่มีการยืนยันตัวตน</span>
        </div>
      </div>
      {children}
    </>
  );
}
