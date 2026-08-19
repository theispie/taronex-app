import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { TASKS, memberById, projectByKey } from '@/mock/data';
import { TASK_STATUSES, taskCode } from '@/lib/types';
import type { Task } from '@/lib/types';

/**
 * หน้าจอ 17 · บอร์ด Kanban  ·  17ข เมื่อ ?group=feature
 * 4 คอลัมน์ตายตัวตลอดไป (กฎข้อ 8) เปลี่ยนได้แค่ป้ายจาก projects.column_labels
 * ?group เป็นพารามิเตอร์ของมุมมองเท่านั้น ไม่แตะฐานข้อมูล
 * ลากในมุมมองงานหลัก = เปลี่ยน feature_id ไม่ใช่เปลี่ยนสถานะ
 * การย้ายสถานะต้องผ่าน POST /tasks/:id/transition เท่านั้น (กฎข้อ 4)
 */
export default async function BoardPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; key: string }>;
  searchParams: Promise<{ group?: string }>;
}) {
  const { tenant, key } = await params;
  const { group } = await searchParams;
  const p = projectByKey(key);
  if (!p) notFound();
  const base = `/${tenant}/projects/${key}`;
  const byFeature = group === 'feature';

  const columns: { id: string; label: string; cards: Task[] }[] = byFeature
    ? [
        ...p.features.map((f) => ({
          id: f.id, label: f.name, cards: TASKS.filter((t) => t.featureId === f.id),
        })),
        { id: 'none', label: 'งานนอกแผน', cards: TASKS.filter((t) => !t.featureId) },
      ]
    : TASK_STATUSES.map((s, i) => ({
        id: s, label: p.columnLabels[i] as string, cards: TASKS.filter((t) => t.status === s),
      }));

  return (
    <>
      <MockNotice />
      <PageHead
        title={p.name}
        desc={`${p.key} · ${p.clientName} · เฟส ${p.phase.name}`}
        right={
          <>
            <span className="sub">จัดคอลัมน์ตาม</span>
            <div className="segsw">
              <Link href={`${base}/board`} className={!byFeature ? 'on' : ''}>สถานะ</Link>
              <Link href={`${base}/board?group=feature`} className={byFeature ? 'on' : ''}>งานหลัก</Link>
            </div>
            <Link href={`${base}/tickets/new`} className="btn btn-pri btn-sm">＋ การ์ดใหม่</Link>
          </>
        }
      />
      <ProjectTabs base={base} warranty={p.phase.kind === 'warranty'} />

      <div className={byFeature ? 'bd bd-scroll' : 'bd'}>
        {columns.map((col) => (
          <section key={col.id} className="bcol">
            <div className="h">
              {!byFeature ? <span className={`sw st-${col.id}`} style={{ background: 'currentColor' }} /> : null}
              <b>{col.label}</b>
              <span className="n">{col.cards.length}</span>
            </div>
            {col.cards.map((t) => (
              <Link key={t.id} href={`/${tenant}/tickets/${taskCode(t)}`} className="tk">
                <div className="cd">{taskCode(t)}</div>
                <div className="ti">{t.title}</div>
                <div className="mt">
                  <Avatar member={memberById(t.assigneeId)} size="sm" />
                  {/* ในมุมมองงานหลัก สถานะย่อลงเป็นป้ายเล็ก เพราะคนดู "หมวดนี้ทำไปกี่ชิ้น" */}
                  {byFeature ? (
                    <span className={`chip st-${t.status}`}>
                      {p.columnLabels[TASK_STATUSES.indexOf(t.status)]}
                    </span>
                  ) : t.type === 'b' ? (
                    <span className="tag bug">{p.typeLabels[1]}</span>
                  ) : null}
                  <span style={{ flex: 1 }} />
                  <HeldTag days={t.heldDays} />
                  {t.priority === 'critical' ? <span className="pr pr-critical">ด่วนมาก</span> : null}
                </div>
              </Link>
            ))}
            {col.cards.length === 0 ? <div className="empty" style={{ padding: 16 }}>ไม่มีการ์ด</div> : null}
          </section>
        ))}
      </div>
    </>
  );
}
