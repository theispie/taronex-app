import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { TASKS, projectByKey } from '@/mock/data';

/**
 * หน้าจอ 16 · ตั้งค่างานหลัก
 * ไม่มีช่องกรอกวันที่ของงานหลักเลย ตั้งใจ — ถ้ากรอกเองได้ แผนกับความจริงจะเพี้ยนภายในสองสัปดาห์
 * วันเริ่ม = MIN(COALESCE(start_date, due_date)) · วันจบ = MAX(due_date) ของการ์ดลูก
 * งานหลักที่ไม่มีการ์ดคือวิธีวางแผนล่วงหน้าโดยไม่ต้องโกหกวันที่
 */
export default async function FeaturesPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  return (
    <>
      <MockNotice />
      <PageHead
        title="งานหลัก"
        desc={`${p.features.length} ก้อน · จัดลำดับได้ด้วยการลาก`}
        right={<button type="button" className="btn btn-pri btn-sm">＋ งานหลักใหม่</button>}
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />
      <Card className="mb">
        {p.features.map((f) => {
          const kids = TASKS.filter((t) => t.featureId === f.id);
          return (
            <div key={f.id} className="row">
              <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
              <span className="row-title">{f.name}</span>
              {kids.length === 0 ? (
                <span className="chip">ยังไม่มีการ์ด — วางแผนไว้ล่วงหน้า</span>
              ) : (
                <span className="sub mn">{kids.length} การ์ด</span>
              )}
              <button type="button" className="btn btn-sm btn-gh">แก้ไข</button>
            </div>
          );
        })}
      </Card>
      <div className="alert i">
        <span>ℹ</span>
        <div><b>เกณฑ์แยกงานหลัก:</b> ถ้าตัดก้อนนี้ออกแล้วลูกค้ายังรับงานได้ = เป็นงานหลักหนึ่งก้อน
          <br />ลบงานหลักแล้วการ์ดลูกไม่หาย แต่จะกลายเป็นงานนอกแผน</div>
      </div>
    </>
  );
}
