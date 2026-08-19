import Link from 'next/link';
import { Avatar, Card, CardHead, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { PROJECTS, TASKS, columnsOfProject, memberById } from '@/mock/data';
import { columnIndexOf, isClosed, taskCode } from '@/lib/types';

/**
 * หน้าจอ 23 · หน้าแรก
 * จัดตามสิ่งที่ต้อง "ตัดสินใจ" ก่อน แล้วค่อยถึงสิ่งที่ต้อง "ทำ"
 * หัวข้อ "รอคุณตัดสินใจ" บอกว่าใครต้องขยับ ไม่ใช่บอกสถานะ
 */
export default async function TenantHome({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const acm = columnsOfProject('ACM');
  // "รอคุณตัดสินใจ" = การ์ดที่อยู่คอลัมน์ก่อนสุดท้าย (ขั้นส่งต่อให้คนตรวจตามธรรมเนียมบอร์ด)
  const waiting = TASKS.filter((t) => columnIndexOf(t, acm) === acm.length - 2);
  const mine = TASKS.filter((t) => t.assigneeId === 'u1' && !isClosed(t, acm));

  return (
    <>
      <MockNotice />
      <PageHead title="สวัสดีตอนบ่าย" desc="วันนี้มี 2 เรื่องที่รอคุณตัดสินใจ" />

      <Card className="mb">
        <CardHead title="รอคุณตัดสินใจ" right={<span className="sub">คุณเป็น PM</span>} />
        {waiting.map((t) => (
          <div key={t.id} className="row">
            <Link href={`/${tenant}/tickets/${taskCode(t)}`} className="cd mn">{taskCode(t)}</Link>
            <span className="row-title">{t.title}</span>
            <HeldTag days={t.heldDays} />
            <Avatar member={memberById(t.assigneeId)} size="sm" />
            <button type="button" className="btn btn-sm btn-2">ตีกลับ</button>
            <button type="button" className="btn btn-sm btn-pri">รับงาน</button>
          </div>
        ))}
        {waiting.length === 0 ? <div className="empty">ไม่มีอะไรรอคุณ</div> : null}
      </Card>

      <Card className="mb">
        <CardHead title="งานของคุณ" />
        {mine.map((t) => (
          <div key={t.id} className="row">
            <span className="cd mn">{taskCode(t)}</span>
            <span className="row-title">{t.title}</span>
            <HeldTag days={t.heldDays} />
          </div>
        ))}
        {mine.length === 0 ? <div className="empty">ยังไม่มีงานที่ถืออยู่</div> : null}
      </Card>

      <div className="ph"><h1 style={{ fontSize: 15 }}>โปรเจกต์</h1></div>
      <div className="grid3">
        {PROJECTS.map((p) => (
          <Link key={p.id} href={`/${tenant}/projects/${p.key}/board`} className="card pcard">
            <div className="card-b">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="cd mn">{p.key}</span>
                <b style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}</b>
              </div>
              <div className="sub" style={{ marginTop: 2 }}>{p.clientName}</div>
              <div style={{ marginTop: 12 }}>
                <span className={`chip ${p.phase.kind === 'warranty' ? 'st-done' : ''}`}>
                  เฟส: {p.phase.name}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
