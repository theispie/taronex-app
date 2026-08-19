import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { featureNameOf, memberById, projectByKey, tasksOfProject } from '@/mock/data';
import { TASK_STATUSES, taskCode } from '@/lib/types';
import type { Task } from '@/lib/types';

/**
 * หน้าจอ 17 · บอร์ด Kanban  ·  17ข เมื่อ ?group=feature
 *
 * ความสัมพันธ์การ์ด ↔ งานหลัก:
 *   tasks.feature_id → features.id (nullable) · NULL = งานนอกแผน
 *   โหมดสถานะ  = 4 คอลัมน์คงที่ แล้วซอยเป็นเลนตามงานหลักในคอลัมน์
 *   โหมดงานหลัก = คอลัมน์กลายเป็นงานหลัก ส่วนสถานะย่อลงเป็นป้ายเล็ก
 *   ทั้งสองโหมดเป็นมุมมองของข้อมูลชุดเดียวกัน ?group ไม่แตะฐานข้อมูล
 *
 * กฎข้อ 8 — จำนวนคอลัมน์คงที่ 4 ตลอดไป เปลี่ยนได้แค่ป้ายจาก projects.column_labels
 * กฎข้อ 4 — ย้ายสถานะต้องผ่าน POST /tasks/:id/transition เท่านั้น
 */
export default async function BoardPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; key: string }>;
  searchParams: Promise<{ group?: string; lanes?: string }>;
}) {
  const { tenant, key } = await params;
  const { group, lanes } = await searchParams;
  const p = projectByKey(key);
  if (!p) notFound();
  const base = `/${tenant}/projects/${key}`;
  const byFeature = group === 'feature';
  const showLanes = lanes !== 'off';
  const tasks = tasksOfProject(key);

  const Card = ({ t, small }: { t: Task; small?: boolean }) => {
    const fname = featureNameOf(key, t.featureId);
    return (
      <Link href={`/${tenant}/tickets/${taskCode(t)}`} className="tk">
        <div className="cd">{taskCode(t)}</div>
        <div className="ti">{t.title}</div>
        <div className="mt">
          <Avatar member={memberById(t.assigneeId)} size="sm" />
          {/* การ์ดบอกเสมอว่าเป็นของงานหลักไหน ยกเว้นตอนที่คอลัมน์คือชื่องานหลักอยู่แล้ว */}
          {!small ? (
            fname
              ? <span className="tag feat">{fname}</span>
              : <span className="tag out">งานนอกแผน</span>
          ) : (
            <span className={`chip st-${t.status}`}>
              {p.columnLabels[TASK_STATUSES.indexOf(t.status)]}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <HeldTag days={t.heldDays} />
          {t.priority === 'critical' ? <span className="pr pr-critical">ด่วนมาก</span> : null}
        </div>
      </Link>
    );
  };

  return (
    <>
      <MockNotice />
      <PageHead
        title={p.name}
        desc={`${p.key} · ${p.clientName} · เฟส ${p.phase.name} · ${tasks.length} การ์ด`}
        right={
          <>
            <span className="sub">จัดคอลัมน์ตาม</span>
            <div className="segsw">
              <Link href={`${base}/board`} className={!byFeature ? 'on' : ''}>สถานะ</Link>
              <Link href={`${base}/board?group=feature`} className={byFeature ? 'on' : ''}>งานหลัก</Link>
            </div>
            {!byFeature ? (
              <Link href={`${base}/board${showLanes ? '?lanes=off' : ''}`} className="btn btn-2 btn-sm">
                {showLanes ? 'ซ่อนเลนงานหลัก' : 'แยกเลนตามงานหลัก'}
              </Link>
            ) : null}
            <Link href={`${base}/tickets/new`} className="btn btn-pri btn-sm">＋ การ์ดใหม่</Link>
          </>
        }
      />
      <ProjectTabs base={base} warranty={p.phase.kind === 'warranty'} />

      {byFeature ? (
        <div className="bd bd-scroll">
          {[...p.features.map((f) => ({
            id: f.id, label: f.name, cards: tasks.filter((t) => t.featureId === f.id),
          })), {
            id: 'none', label: 'งานนอกแผน', cards: tasks.filter((t) => !t.featureId),
          }].map((col) => (
            <section key={col.id} className="bcol">
              <div className="h"><b>{col.label}</b><span className="n">{col.cards.length}</span></div>
              {col.cards.map((t) => <Card key={t.id} t={t} small />)}
              {col.cards.length === 0
                ? <div className="empty" style={{ padding: 16 }}>ยังไม่มีการ์ด</div> : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="bd">
          {TASK_STATUSES.map((status, i) => {
            const inCol = tasks.filter((t) => t.status === status);
            const lanesData = showLanes
              ? [...p.features.map((f) => ({
                  id: f.id, label: f.name, cards: inCol.filter((t) => t.featureId === f.id),
                })), {
                  id: 'none', label: 'งานนอกแผน', cards: inCol.filter((t) => !t.featureId),
                }].filter((l) => l.cards.length > 0)
              : [{ id: 'all', label: '', cards: inCol }];

            return (
              <section key={status} className="bcol">
                <div className="h">
                  <span className={`sw st-${status}`} style={{ background: 'currentColor' }} />
                  <b>{p.columnLabels[i]}</b>
                  <span className="n">{inCol.length}</span>
                </div>
                {lanesData.map((lane) => (
                  <div key={lane.id}>
                    {lane.label ? (
                      <div className="swl">
                        {lane.id === 'none' ? '⚑ ' : ''}{lane.label}
                        <span style={{ marginLeft: 'auto' }}>{lane.cards.length}</span>
                      </div>
                    ) : null}
                    {lane.cards.map((t) => <Card key={t.id} t={t} />)}
                  </div>
                ))}
                {inCol.length === 0
                  ? <div className="empty" style={{ padding: 16 }}>ไม่มีการ์ด</div> : null}
              </section>
            );
          })}
        </div>
      )}

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>การ์ดหนึ่งใบผูกกับงานหลักได้ก้อนเดียว (<code>tasks.feature_id</code>) —
          การ์ดที่ไม่ผูกกับก้อนไหนเลยคือ “งานนอกแผน” ซึ่งเป็นตัวเลขที่ใช้วัดขอบเขตงานบานปลาย</div>
      </div>
    </>
  );
}
