import Link from 'next/link';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { PROJECTS, TASKS, memberById } from '@/mock/data';

/**
 * หน้าจอ 11 · รายการโปรเจกต์
 * ตัวเลขสามตัวคือ "สุขภาพโปรเจกต์" สำหรับงานเหมา —
 * ขอบเขตบานปลายวัดจากจำนวนการ์ด ไม่ใช่ชั่วโมง
 * การ์ดที่เพิ่ม = COUNT(tasks) − baseline_task_count
 */
export default async function ProjectsPage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <MockNotice />
      <PageHead
        title="โปรเจกต์"
        desc={`${PROJECTS.length} โปรเจกต์ที่เปิดอยู่ · ปิดแล้วไม่นับโควตา`}
        right={<Link href={`/${tenant}/projects/new`} className="btn btn-pri">＋ โปรเจกต์ใหม่</Link>}
      />
      <div className="grid3">
        {PROJECTS.map((p) => {
          const total = p.key === 'ACM' ? TASKS.length : p.baselineTaskCount + 2;
          const added = total - p.baselineTaskCount;
          const pm = memberById(p.pmUserId);
          const risk = added > 6 ? 'danger' : added > 2 ? 'warn' : 'ok';
          return (
            <Link key={p.id} href={`/${tenant}/projects/${p.key}`} className="card pcard">
              <div className="card-b">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="cd mn">{p.key}</span>
                  <b style={{ fontSize: 13.5 }}>{p.name}</b>
                  <span className={`dot dot-${risk}`} style={{ marginLeft: 'auto' }} />
                </div>
                <div className="sub" style={{ marginTop: 2 }}>{p.clientName}</div>
                <div style={{ margin: '10px 0' }}>
                  <span className={`chip ${p.phase.kind === 'warranty' ? 'st-done' : ''}`}>
                    เฟส: {p.phase.name}</span>
                </div>
                <div className="hstat">
                  <div><b>{total}</b><span>การ์ดทั้งหมด</span></div>
                  <div><b className={added > 2 ? 'txt-warn' : ''}>+{added}</b><span>การ์ดที่เพิ่ม</span></div>
                  <div><b>2</b><span>รอบตีกลับ</span></div>
                </div>
                <div className="sub" style={{ marginTop: 10, fontSize: 11.5 }}>PM · {pm?.name}</div>
              </div>
            </Link>
          );
        })}
      </div>
      <div className="alert i" style={{ marginTop: 16 }}>
        <span>ℹ</span><div>โปรเจกต์ที่ปิดแล้วไม่นับโควตา และข้อมูลยังอยู่ครบ</div>
      </div>
    </>
  );
}
