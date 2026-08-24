import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withoutTenant } from '@/db/client';
import { tenantBySlug } from '@/lib/portal/session';

/**
 * เปลือกพอร์ทัลลูกค้า — ห้ามมีชื่อหรือโลโก้ TaroNex ทั้งหน้า
 * ลูกค้าเห็นแต่แบรนด์ของเอเจนซี่ เป็นการตัดสินใจเรื่องตำแหน่งทางธุรกิจ ไม่ใช่ความสวยงาม
 *
 * ข้อควรระวังด้านความปลอดภัย: ในสเปคเดิมพอร์ทัลอยู่คนละโดเมน (taronex-support.com)
 * เพื่อให้เบราว์เซอร์บังคับแยกคุกกี้ให้เอง พอย้ายมาอยู่ path เดียวกัน
 * การแยกต้องทำด้วยโค้ดทั้งหมด — ดู `src/lib/portal/session.ts`
 *
 * ชื่อเอเจนซี่ตรงนี้อ่านจาก slug ตรงๆ ไม่ต้องล็อกอิน — มันคือแบรนด์บนหน้าที่ลูกค้าเปิด
 * ส่วน**ชื่อผู้ติดต่อ**อยู่ในหน้าแรก ไม่ใช่ในเปลือก เพราะต้องมีเซสชันถึงจะรู้ว่าใคร
 * และไม่อยากยิงคำขอเพิ่มอีกหนึ่งครั้งในทุกหน้าเพียงเพื่อแสดงชื่อ
 */
export const dynamic = 'force-dynamic';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await withoutTenant((tx) => tenantBySlug(tx, slug)).catch(() => null);
  if (!tenant) notFound();

  const initials = tenant.name.replace(/\s+/g, '').slice(0, 2).toUpperCase();

  return (
    <div className="pw">
      <div className="pw-top">
        <Link href={`/portal/${slug}`} className="lg">
          {initials}
        </Link>
        <b>{tenant.name}</b>
        <span style={{ flex: 1 }} />
      </div>
      <div className="pw-in">{children}</div>
    </div>
  );
}
