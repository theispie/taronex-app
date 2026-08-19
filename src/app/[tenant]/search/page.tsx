import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { TASKS, projectByKey } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 22 · ค้นหาทั่วที่ทำงาน
 * ค้นข้ามทุกโปรเจกต์ เพราะคนจำได้แค่ว่า "เรื่องอนุมัติ" ไม่ได้จำว่าอยู่โปรเจกต์ไหน
 * รหัสการ์ดอยู่ซ้ายสุด พิมพ์ ACM-138 ตรงๆ ก็เจอทันที
 * ดัชนีภาษาไทยใช้ tsvector config simple + ตัดคำด้วยไลบรารีไทย
 */
export default async function SearchPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenant } = await params;
  const { q } = await searchParams;
  const results = q ? TASKS.filter((t) => t.title.includes(q) || taskCode(t).includes(q)) : TASKS;

  return (
    <>
      <MockNotice />
      <PageHead title="ค้นหา" desc={q ? `ผลการค้นหา “${q}”` : 'ค้นข้ามทุกโปรเจกต์ในที่ทำงานนี้'} />
      <div className="filters mb">
        <input className="inp" defaultValue={q} placeholder="พิมพ์คำ หรือรหัสการ์ด เช่น ACM-138"
               style={{ maxWidth: 320 }} />
        <select className="inp" style={{ maxWidth: 160 }}><option>ทุกโปรเจกต์</option></select>
        <select className="inp" style={{ maxWidth: 140 }}><option>ทุกสถานะ</option></select>
      </div>
      <Card>
        <table className="tbl">
          <thead><tr><th style={{ width: 84 }}>รหัส</th><th>ชื่อ</th>
            <th style={{ width: 160 }}>โปรเจกต์</th></tr></thead>
          <tbody>
            {results.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/${tenant}/tickets/${taskCode(t)}`} className="cd mn">
                  {taskCode(t)}</Link></td>
                <td style={{ fontWeight: 500 }}>{t.title}</td>
                <td className="sub">{projectByKey(t.projectKey)?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {results.length === 0 ? <div className="empty">ไม่พบผลลัพธ์</div> : null}
      </Card>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>ยังไม่มีการบันทึกมุมมองที่ค้นบ่อย — ตัวกรองอยู่ใน URL อยู่แล้ว
          คัดลอกลิงก์เก็บไว้ในบุ๊กมาร์กใช้แทนได้</div>
      </div>
    </>
  );
}
