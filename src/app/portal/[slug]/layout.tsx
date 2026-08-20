import Link from 'next/link';

/**
 * เปลือกพอร์ทัลลูกค้า — ห้ามมีชื่อหรือโลโก้ TaroNex ทั้งหน้า
 * ลูกค้าเห็นแต่แบรนด์ของเอเจนซี่ เป็นการตัดสินใจเรื่องตำแหน่งทางธุรกิจ ไม่ใช่ความสวยงาม
 *
 * ข้อควรระวังด้านความปลอดภัย: ในสเปคเดิมพอร์ทัลอยู่คนละโดเมน (taronex-support.com)
 * เพื่อให้เบราว์เซอร์บังคับแยกคุกกี้ให้เอง พอย้ายมาอยู่ path เดียวกัน
 * การแยกต้องทำด้วยโค้ดทั้งหมด — คุกกี้คนละชื่อ คนละ secret และ API ฝั่งพอร์ทัล
 * ต้องปฏิเสธ session ของทีม (และกลับกัน)
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="pw">
      <div className="pw-top">
        <Link href={`/portal/${slug}`} className="lg">
          DX
        </Link>
        <b>ดิจิทัลเอ็กซ์ จำกัด</b>
        <span style={{ flex: 1 }} />
        <span className="sub">คุณสมหญิง · ทองไทย มีเดีย</span>
      </div>
      <div className="pw-in">{children}</div>
    </div>
  );
}
