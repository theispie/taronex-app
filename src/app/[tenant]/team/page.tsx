import { Avatar, Card, HeldFlag, MockNotice } from '@/components/ui';
import { MEMBERS, TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 26 · ภาพรวมทีม (โหมด "ตอนนี้")
 * ตอบว่าใครถืออะไรอยู่ — คนละคำถามกับโหมด "ช่วงเวลา" (หน้าจอ 27)
 * ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ (กฎข้อ 9)
 */
export default function TeamPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <MockNotice />
      <h1 className="mb-1 text-xl font-semibold text-ink">ภาพรวมทีม</h1>
      <p className="mb-6 text-sm text-muted">ตอนนี้ใครถืออะไรอยู่</p>

      <div className="flex flex-col gap-3">
        {MEMBERS.filter((m) => m.role !== 'viewer').map((m) => {
          const held = TASKS.filter((t) => t.assigneeId === m.id && t.status !== 'done');
          return (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar member={m} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{m.name}</div>
                  <div className="text-xs text-muted">{JOB_LABEL[m.jobTitle]}</div>
                </div>
                <span className="text-xs text-muted">ถืออยู่ {held.length} ใบ</span>
              </div>
              {held.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-2 pt-3">
                  {held.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted">{taskCode(t)}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-2">{t.title}</span>
                      <HeldFlag days={t.heldDays} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-line-2 pt-3 text-sm text-muted">
                  ไม่มีความเคลื่อนไหว
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const JOB_LABEL: Record<string, string> = {
  pm: 'PM', ba: 'BA', dev: 'เดฟ', qa: 'QA', design: 'ดีไซน์', other: 'อื่นๆ',
};
