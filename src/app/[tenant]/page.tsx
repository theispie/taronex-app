import Link from 'next/link';
import { Avatar, Card, HeldFlag, MockNotice, SectionTitle } from '@/components/ui';
import { PROJECTS, TASKS, memberById } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 23 · หน้าแรก
 * จัดตามสิ่งที่ต้อง "ตัดสินใจ" ก่อน แล้วค่อยถึงสิ่งที่ต้อง "ทำ"
 * หน้านี้ไม่มีข้อมูลของตัวเอง ทุกบล็อกคือ query ที่มีอยู่แล้ว จัดเรียงใหม่
 */
export default async function TenantHome({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const waiting = TASKS.filter((t) => t.status === 'review');
  const mine = TASKS.filter((t) => t.assigneeId === 'u1' && t.status !== 'done');

  return (
    <div className="mx-auto max-w-5xl">
      <MockNotice />
      <h1 className="mb-6 text-xl font-semibold text-ink">สวัสดีตอนบ่าย</h1>

      <section className="mb-8">
        <SectionTitle hint="คุณเป็น PM ของโปรเจกต์นี้">รอคุณตัดสินใจ</SectionTitle>
        <Card>
          {waiting.map((t, i) => (
            <div
              key={t.id}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line-2' : ''}`}
            >
              <Link
                href={`/${tenant}/tickets/${taskCode(t)}`}
                className="font-mono text-xs text-brand hover:underline"
              >
                {taskCode(t)}
              </Link>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
              <HeldFlag days={t.heldDays} />
              <Avatar member={memberById(t.assigneeId)} size={24} />
              <span className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-md bg-done-bg px-2.5 py-1 text-xs font-medium text-done"
                >
                  รับงาน
                </button>
                <button
                  type="button"
                  className="rounded-md bg-warn-bg px-2.5 py-1 text-xs font-medium text-warn"
                >
                  ตีกลับ
                </button>
              </span>
            </div>
          ))}
          {waiting.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">ไม่มีอะไรรอคุณ</p>
          ) : null}
        </Card>
      </section>

      <section className="mb-8">
        <SectionTitle>งานของคุณ</SectionTitle>
        <Card>
          {mine.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line-2' : ''}`}
            >
              <span className="font-mono text-xs text-muted">{taskCode(t)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
              <HeldFlag days={t.heldDays} />
            </div>
          ))}
          {mine.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">ยังไม่มีงานที่ถืออยู่</p>
          ) : null}
        </Card>
      </section>

      <section>
        <SectionTitle>โปรเจกต์</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROJECTS.map((p) => (
            <Link key={p.id} href={`/${tenant}/projects/${p.key}/board`}>
              <Card className="h-full p-4 transition-colors hover:border-brand">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-muted">{p.key}</span>
                  <span className="truncate font-medium text-ink">{p.name}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{p.clientName}</p>
                <p className="mt-3 text-xs text-muted">
                  เฟส: {p.phase.name}
                  {p.phase.kind === 'warranty' ? ' · อยู่ในช่วงประกัน' : ''}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
