import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, HeldFlag, MockNotice } from '@/components/ui';
import { TASKS, memberById, projectByKey } from '@/mock/data';
import { TASK_STATUSES, taskCode } from '@/lib/types';

/**
 * หน้าจอ 17 · บอร์ด Kanban
 * 4 คอลัมน์ตายตัวตลอดไป (กฎข้อ 8) เปลี่ยนได้แค่ป้ายที่แสดงจาก projects.column_labels
 * การย้ายการ์ดจะยิง POST /tasks/:id/transition เท่านั้น (กฎข้อ 4) — ยังไม่ต่อ API ในรอบนี้
 */
export default async function BoardPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const project = projectByKey(key);
  if (!project) notFound();

  return (
    <div>
      <MockNotice />
      <div className="mb-4 flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold text-ink">{project.name}</h1>
        <span className="font-mono text-sm text-muted">{project.key}</span>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700">
          เฟส: {project.phase.name}
        </span>
        <span className="ml-auto text-xs text-muted">จัดคอลัมน์ตาม: สถานะ</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status, col) => {
          const cards = TASKS.filter((t) => t.status === status);
          return (
            <section key={status} className="rounded-lg bg-surface-2 p-2">
              <header className="flex items-center justify-between px-1.5 py-1.5">
                <h2 className="text-sm font-semibold text-ink-2">
                  {project.columnLabels[col]}
                </h2>
                <span className="text-xs text-faint">{cards.length}</span>
              </header>
              <div className="flex flex-col gap-2">
                {cards.map((t) => (
                  <Link
                    key={t.id}
                    href={`/${tenant}/tickets/${taskCode(t)}`}
                    className="block rounded-md border border-line bg-surface p-3 shadow-1 transition-shadow hover:shadow-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted">{taskCode(t)}</span>
                      {t.priority === 'critical' ? (
                        <span className="rounded-full bg-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-danger">
                          ด่วนมาก
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-sm leading-snug text-ink">{t.title}</p>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Avatar member={memberById(t.assigneeId)} size={22} />
                      <span className="flex-1" />
                      <HeldFlag days={t.heldDays} />
                    </div>
                  </Link>
                ))}
                {cards.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-faint">ไม่มีการ์ด</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
