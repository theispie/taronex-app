import { HeldFlag, MockNotice, Card, SectionTitle } from '@/components/ui';
import { TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 24 · งานที่ได้รับ
 * จัดกลุ่มตามความเร่งด่วน ไม่ใช่ตามโปรเจกต์ — คนทำงานสนใจว่า "อะไรก่อน"
 * ปุ่มตอบเวลาเสร็จไม่ใช่ timesheet
 */
export default function MyTasksPage() {
  const mine = TASKS.filter((t) => t.assigneeId === 'u1' || t.assigneeId === 'u2');
  const groups = [
    { key: 'today', label: 'วันนี้', items: mine.filter((t) => t.eta === 'today') },
    { key: 'tomorrow', label: 'พรุ่งนี้', items: mine.filter((t) => t.eta === 'tomorrow') },
    { key: 'rest', label: 'ยังไม่ได้ตอบว่าจะเสร็จเมื่อไร', items: mine.filter((t) => !t.eta) },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <MockNotice />
      <h1 className="mb-6 text-xl font-semibold text-ink">งานที่ได้รับ</h1>
      {groups.map((g) => (
        <section key={g.key} className="mb-6">
          <SectionTitle>{g.label}</SectionTitle>
          <Card>
            {g.items.map((t, i) => (
              <div
                key={t.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line-2' : ''}`}
              >
                <span className="font-mono text-xs text-muted">{taskCode(t)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
                <HeldFlag days={t.heldDays} />
                <button
                  type="button"
                  className="rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:bg-line-2"
                >
                  จะเสร็จเมื่อไร
                </button>
              </div>
            ))}
            {g.items.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-muted">ไม่มีงานในกลุ่มนี้</p>
            ) : null}
          </Card>
        </section>
      ))}
      <p className="text-xs text-muted">
        ปุ่ม “จะเสร็จเมื่อไร” ไม่ใช่การลงเวลาทำงาน — ใช้ให้ทีมรู้ลำดับเท่านั้น
      </p>
    </div>
  );
}
