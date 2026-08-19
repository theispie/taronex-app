import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { TASKS, memberById, projectByKey } from '@/mock/data';
import { TASK_STATUSES, taskCode } from '@/lib/types';

/**
 * หน้าจอ 17 · บอร์ด Kanban
 * 4 คอลัมน์ตายตัวตลอดไป (กฎข้อ 8) เปลี่ยนได้แค่ป้ายจาก projects.column_labels
 * การย้ายการ์ดต้องผ่าน POST /tasks/:id/transition เท่านั้น (กฎข้อ 4) — ยังไม่ต่อ API รอบนี้
 */
export default async function BoardPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const project = projectByKey(key);
  if (!project) notFound();

  return (
    <>
      <MockNotice />
      <PageHead
        title={project.name}
        desc={`${project.key} · ลูกค้า ${project.clientName} · เฟส ${project.phase.name}`}
        right={
          <>
            <span className="sub">จัดคอลัมน์ตาม</span>
            <div className="segsw">
              <button type="button" className="on">สถานะ</button>
              <button type="button">งานหลัก</button>
            </div>
            <button type="button" className="btn btn-pri btn-sm">＋ การ์ดใหม่</button>
          </>
        }
      />

      <div className="bd">
        {TASK_STATUSES.map((status, col) => {
          const cards = TASKS.filter((t) => t.status === status);
          return (
            <section key={status} className="bcol">
              <div className="h">
                <span className={`sw st-${status}`} style={{ background: 'currentColor' }} />
                <b>{project.columnLabels[col]}</b>
                <span className="n">{cards.length}</span>
              </div>
              {cards.map((t) => (
                <Link key={t.id} href={`/${tenant}/tickets/${taskCode(t)}`} className="tk">
                  <div className="cd">{taskCode(t)}</div>
                  <div className="ti">{t.title}</div>
                  <div className="mt">
                    <Avatar member={memberById(t.assigneeId)} size="sm" />
                    {t.type === 'b' ? <span className="tag bug">{project.typeLabels[1]}</span> : null}
                    <span style={{ flex: 1 }} />
                    <HeldTag days={t.heldDays} />
                    {t.priority === 'critical' ? (
                      <span className="pr pr-critical">ด่วนมาก</span>
                    ) : null}
                  </div>
                </Link>
              ))}
              {cards.length === 0 ? <div className="empty" style={{ padding: 16 }}>ไม่มีการ์ด</div> : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
