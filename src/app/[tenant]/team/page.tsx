import { Avatar, Card, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS, TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 26 · ภาพรวมทีม (โหมด "ตอนนี้")
 * ตอบว่าใครถืออะไรอยู่ — คนละคำถามกับโหมด "ช่วงเวลา" (หน้าจอ 27)
 * ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ (กฎข้อ 9)
 * คนที่ไม่มีความเคลื่อนไหวแสดงเป็นสีกลาง ไม่ใช่สีเตือน
 */
const JOB_LABEL: Record<string, string> = {
  pm: 'PM', ba: 'BA', dev: 'Dev', qa: 'QA', design: 'Design', other: 'อื่นๆ',
};

export default function TeamPage() {
  const people = MEMBERS.filter((m) => m.role !== 'viewer' && m.role !== 'guest');
  return (
    <>
      <MockNotice />
      <PageHead
        title="ภาพรวมทีม"
        desc="ตอนนี้ใครถืออะไรอยู่"
        right={
          <div className="segsw">
            <button type="button" className="on">ตอนนี้</button>
            <button type="button">ช่วงเวลา</button>
          </div>
        }
      />
      <div className="grid2">
        {people.map((m) => {
          const held = TASKS.filter((t) => t.assigneeId === m.id && t.status !== 'done');
          return (
            <Card key={m.id}>
              <div className="card-h">
                <Avatar member={m} />
                <div style={{ minWidth: 0 }}>
                  <b>{m.name}</b>
                  <div className="sub" style={{ fontSize: 11.5 }}>{JOB_LABEL[m.jobTitle]}</div>
                </div>
                <div className="r"><span className="sub">ถืออยู่ {held.length} ใบ</span></div>
              </div>
              {held.length > 0 ? (
                held.map((t) => (
                  <div key={t.id} className="row">
                    <span className="cd mn">{taskCode(t)}</span>
                    <span className="row-title">{t.title}</span>
                    <HeldTag days={t.heldDays} />
                  </div>
                ))
              ) : (
                <div className="empty">ไม่มีความเคลื่อนไหว</div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
