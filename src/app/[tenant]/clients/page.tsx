import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { CLIENTS } from '@/mock/data';

/**
 * หน้าจอ 28 · รายชื่อลูกค้า
 * พอร์ทัลผูกกับเฟส ไม่ใช่สวิตช์แยก — ลดจำนวนสิ่งที่ต้องจำว่าเปิดหรือยัง
 * คอลัมน์ผู้ติดต่อบอกจำนวนคน ไม่ใช่ชื่อ เพราะรายชื่อยาวเกินกว่าจะใส่ในตาราง
 * "ยังไม่เปิด" ไม่ใช่ "ปิด" เพราะเป็นสถานะปกติของโปรเจกต์ที่ยังทำอยู่
 */
export default async function ClientsPage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <MockNotice />
      <PageHead
        title="ลูกค้า"
        desc={`${CLIENTS.length} ราย · บัญชีลูกค้าฟรีทุกแผน ไม่นับโควตา`}
        right={<Link href={`/${tenant}/clients/new`} className="btn btn-pri btn-sm">＋ เพิ่มลูกค้า</Link>}
      />
      <Card>
        <table className="tbl">
          <thead><tr><th>ชื่อลูกค้า</th><th>ผู้ติดต่อ</th><th>โปรเจกต์</th>
            <th>พอร์ทัล</th><th /></tr></thead>
          <tbody>
            {CLIENTS.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>
                  <Link href={`/${tenant}/clients/${c.id}`}>{c.name}</Link></td>
                <td className="mn sub">{c.contacts} คน</td>
                <td className="mn sub">{c.projects}</td>
                <td>{c.portalEnabled
                  ? <span className="chip st-done">เปิดอยู่</span>
                  : <span className="chip">ยังไม่เปิด</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  <Link href={`/${tenant}/clients/${c.id}`} className="btn btn-sm btn-gh">จัดการ</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>พอร์ทัลเปิดอัตโนมัติเมื่อโปรเจกต์เข้าเฟสประกัน — ไม่มีสวิตช์แยกให้ลืมเปิด</div>
      </div>
    </>
  );
}
