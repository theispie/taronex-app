import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { projectByKey } from '@/mock/data';

/**
 * หน้าจอ 15 · ตั้งค่าเฟส
 * เฟสเป็นวงจรชีวิตของโปรเจกต์ ไม่ใช่การจัดกลุ่มการ์ด — ต้องแยกให้ขาดในหัวผู้ใช้
 * เฟสประกันเป็นสวิตช์เปิดพอร์ทัลและ SLA จึงมีความหมายในทางระบบจริง ไม่ใช่แค่ป้าย
 */
const PHASES = [
  { name: 'วางแผน', kind: 'normal' },
  { name: 'ออกแบบ', kind: 'normal' },
  { name: 'พัฒนา', kind: 'normal' },
  { name: 'ส่งมอบ', kind: 'delivery' },
  { name: 'ประกัน', kind: 'warranty' },
];

export default async function PhasesPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  return (
    <>
      <MockNotice />
      <PageHead title="เฟส" desc={`${p.name} · ตอนนี้อยู่เฟส “${p.phase.name}”`} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />

      <div className="alert w" style={{ marginBottom: 14 }}>
        <span>⚠</span>
        <div><b>เฟส ไม่ใช่ สถานะ</b><br />
          เฟส = วงจรชีวิตของทั้งโปรเจกต์ มีทีละหนึ่งค่า ·
          สถานะ = การ์ดใบนั้นไปถึงไหน คงที่ 4 ค่า</div>
      </div>

      <Card>
        {PHASES.map((ph) => (
          <div key={ph.name} className={`row ${ph.name === p.phase.name ? 'row-on' : ''}`}>
            <span className="row-title" style={{ fontWeight: ph.name === p.phase.name ? 600 : 400 }}>
              {ph.name}
            </span>
            {ph.kind === 'warranty' ? (
              <span className="chip st-done">เปิดพอร์ทัลลูกค้า + เริ่มนาฬิกา SLA</span>
            ) : ph.kind === 'delivery' ? (
              <span className="chip st-review">แช่แข็งตัวเลขช่วงส่งมอบ</span>
            ) : null}
            {ph.name === p.phase.name ? <span className="chip st-doing">อยู่ตรงนี้</span>
              : <button type="button" className="btn btn-sm btn-2">ย้ายมาเฟสนี้</button>}
          </div>
        ))}
      </Card>
      <div className="hint" style={{ marginTop: 10 }}>
        เข้าเฟสประกัน = เปิด portal_enabled + สร้าง sla_clock ตามสัญญาของลูกค้ารายนั้น
      </div>
    </>
  );
}
