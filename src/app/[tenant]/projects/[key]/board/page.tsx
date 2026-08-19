import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import {
  columnOfTask, columnsOfProject, featureNameOf, memberById, projectByKey, tasksOfProject,
} from '@/mock/data';
import { ROLE_EFFECT, columnRole, columnTone, taskCode } from '@/lib/types';
import type { Task } from '@/lib/types';

/**
 * หน้าจอ 17 · บอร์ด Kanban  ·  17ข เมื่อ ?group=feature
 *
 * ความสัมพันธ์การ์ด ↔ งานหลัก:
 *   tasks.feature_id → features.id (nullable) · NULL = งานนอกแผน
 *   โหมดคอลัมน์  = คอลัมน์ตามที่แม่แบบตั้งไว้ แล้วซอยเป็นเลนตามงานหลักในคอลัมน์
 *   โหมดงานหลัก  = คอลัมน์กลายเป็นงานหลัก ส่วนคอลัมน์เดิมย่อลงเป็นป้ายเล็ก
 *   ทั้งสองโหมดเป็นมุมมองของข้อมูลชุดเดียวกัน ?group ไม่แตะฐานข้อมูล
 *
 * กติกาอ่านจากลำดับคอลัมน์ล้วนๆ — คอลัมน์สุดท้าย = ปิดงาน · ลากถอยหลัง = ตีกลับ
 * การย้ายทุกครั้งยังต้องผ่าน POST /tasks/:id/transition เท่านั้น (กฎข้อ 4)
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
  const cols = columnsOfProject(key);

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
            <span className="chip">{columnOfTask(t, cols)?.name}</span>
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
              <Link href={`${base}/board`} className={!byFeature ? 'on' : ''}>คอลัมน์</Link>
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
        <div className={cols.length > 4 ? 'bd bd-scroll' : 'bd'}>
          {cols.map((col, ci) => {
            const inCol = tasks.filter((t) => t.columnKey === col.key);
            const lanesData = showLanes
              ? [...p.features.map((f) => ({
                  id: f.id, label: f.name, cards: inCol.filter((t) => t.featureId === f.id),
                })), {
                  id: 'none', label: 'งานนอกแผน', cards: inCol.filter((t) => !t.featureId),
                }].filter((l) => l.cards.length > 0)
              : [{ id: 'all', label: '', cards: inCol }];

            return (
              <section key={col.key} className="bcol">
                <div className="h">
                  <span className={`sw st-${columnTone(ci, cols.length)}`}
                        style={{ background: 'currentColor' }} />
                  <b>{col.name}</b>
                  {/* คอลัมน์สุดท้ายบอกไว้ว่าลากมาแล้วปิดงาน จะได้ไม่เผลอ */}
                  {ci === cols.length - 1
                    ? <span className="colmap" title={ROLE_EFFECT.last}>ปิดงาน</span> : null}
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
        <div>
          บอร์ดนี้มี {cols.length} คอลัมน์ · การ์ดใหม่ลง “{cols[0]?.name}” ·
          ลากถึง “{cols[cols.length - 1]?.name}” ถือว่าปิดงาน (PM เท่านั้น)
          <br />ลากถอยหลังนับเป็นการตีกลับ ต้องใส่เหตุผล และการ์ดกลับไปหาเจ้าของคนก่อน
          <br />การ์ดหนึ่งใบผูกกับงานหลักได้ก้อนเดียว — ที่ไม่ผูกเลยคือ “งานนอกแผน”
        </div>
      </div>
    </>
  );
}
