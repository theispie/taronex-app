import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { TASKS, WARRANTY_TASKS, memberById, projectByKey } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 13 · ภาพรวมโปรเจกต์  ·  13ข เมื่อโปรเจกต์อยู่ในเฟสประกัน
 * สี่ตัวเลขบนสุดคือสิ่งที่ PM ควรเห็นทุกเช้า สามในสี่เกี่ยวกับขอบเขตงานบานปลาย
 * ตัวเลขช่วงส่งมอบถูกแช่แข็งตอนกดส่งมอบ ไม่งั้นบั๊กประกันจะทำให้ "การ์ดที่เพิ่ม" พุ่งตลอด 12 เดือน
 * ทุกตัวเลขคำนวณสด ไม่มีตารางสรุป
 */
export default async function ProjectOverview({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  const base = `/${tenant}/projects/${key}`;
  const warranty = p.phase.kind === 'warranty';
  const pm = memberById(p.pmUserId);
  const stale = TASKS.filter((t) => t.heldDays > 3 && t.status !== 'done');

  return (
    <>
      <MockNotice />
      <PageHead
        title={p.name}
        desc={`${p.key} · ${p.clientName} · PM ${pm?.name}`}
        right={<span className={`chip ${warranty ? 'st-done' : ''}`}>เฟส: {p.phase.name}</span>}
      />
      <ProjectTabs base={base} warranty={warranty} />

      {warranty ? (
        <div className="alert o" style={{ marginBottom: 14 }}>
          <span>✓</span>
          <div>ส่งมอบแล้วเมื่อ {p.deliveredAt} · ตัวเลขช่วงส่งมอบถูกแช่แข็งไว้
            งานประกันหลังจากนี้ไม่นับรวมในขอบเขตงานส่งมอบ</div>
        </div>
      ) : null}

      <div className="statgrid mb">
        <Card><div className="card-b stat">
          <b>{warranty ? p.baselineTaskCount : TASKS.length}</b>
          <span>การ์ดทั้งหมด{warranty ? ' (แช่แข็ง)' : ''}</span></div></Card>
        <Card><div className="card-b stat">
          <b className="txt-warn">+{warranty ? 5 : TASKS.length - p.baselineTaskCount}</b>
          <span>การ์ดที่เพิ่มจากแผนแรก</span></div></Card>
        <Card><div className="card-b stat"><b>2</b><span>รอบตีกลับ</span></div></Card>
        <Card><div className="card-b stat">
          <b className={stale.length ? 'txt-danger' : ''}>{stale.length}</b>
          <span>ต้องดูด่วน</span></div></Card>
      </div>

      {warranty ? (
        <Card className="mb">
          <div className="card-h"><b>งานประกันที่ยังไม่ปิด</b>
            <div className="r"><Link href={`/${tenant}/sla`} className="btn btn-2 btn-sm">ไปศูนย์ SLA</Link></div>
          </div>
          {WARRANTY_TASKS.map((t) => (
            <div key={t.id} className="row">
              <span className="cd mn">{taskCode(t)}</span>
              <span className="row-title">{t.title}</span>
              {t.warrantyScope === 'billable' ? (
                <span className="chip st-doing">งานเพิ่ม — ทำให้ฟรี</span>
              ) : t.warrantyScope === 'pending' ? (
                <span className="chip">รอคัดแยก</span>
              ) : <span className="chip st-done">อยู่ในประกัน</span>}
            </div>
          ))}
        </Card>
      ) : (
        <Card className="mb">
          <div className="card-h"><b>ต้องดูด่วน</b>
            <div className="r"><span className="sub">ค้างเกิน 3 วัน</span></div></div>
          {stale.map((t) => (
            <div key={t.id} className="row">
              <span className="cd mn">{taskCode(t)}</span>
              <span className="row-title">{t.title}</span>
              <span className="tag hold">ถือมา {t.heldDays} วัน</span>
            </div>
          ))}
          {stale.length === 0 ? <div className="empty">ไม่มีการ์ดที่ค้างนาน</div> : null}
        </Card>
      )}

      <Card>
        <div className="card-h"><b>งานหลัก</b>
          <div className="r"><Link href={`${base}/features`} className="btn btn-2 btn-sm">ตั้งค่างานหลัก</Link></div></div>
        {p.features.map((f) => {
          const kids = TASKS.filter((t) => t.featureId === f.id);
          const done = kids.filter((t) => t.status === 'done').length;
          return (
            <div key={f.id} className="row">
              <span className="row-title">{f.name}</span>
              {kids.length === 0 ? (
                <span className="sub">ยังไม่มีการ์ด — วางแผนล่วงหน้าไว้</span>
              ) : (
                <>
                  <span className="sub mn">{done}/{kids.length}</span>
                  <div className="prog" style={{ width: 120 }}>
                    <i style={{ width: `${(done / kids.length) * 100}%` }} /></div>
                </>
              )}
            </div>
          );
        })}
      </Card>
    </>
  );
}
