import { Card, CardHead, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 24 · งานที่ได้รับ
 * จัดกลุ่มตามความเร่งด่วน ไม่ใช่ตามโปรเจกต์ — คนทำงานสนใจว่า "อะไรก่อน"
 * ปุ่มตอบเวลาเสร็จอยู่ในแถวเลย และไม่ใช่ timesheet
 */
export default function MyTasksPage() {
  const mine = TASKS.filter((t) => t.assigneeId === 'u1' || t.assigneeId === 'u2');
  const groups = [
    { key: 'today', label: 'วันนี้', items: mine.filter((t) => t.eta === 'today') },
    { key: 'tomorrow', label: 'พรุ่งนี้', items: mine.filter((t) => t.eta === 'tomorrow') },
    { key: 'rest', label: 'ยังไม่ได้ตอบว่าจะเสร็จเมื่อไร', items: mine.filter((t) => !t.eta) },
  ];

  return (
    <>
      <MockNotice />
      <PageHead title="งานที่ได้รับ" desc={`${mine.length} ใบที่ถืออยู่`} />
      {groups.map((g) => (
        <Card key={g.key} className="mb">
          <CardHead title={g.label} right={<span className="sub">{g.items.length} ใบ</span>} />
          {g.items.map((t) => (
            <div key={t.id} className="row">
              <span className="cd mn">{taskCode(t)}</span>
              <span className="row-title">{t.title}</span>
              <HeldTag days={t.heldDays} />
              <button type="button" className="btn btn-sm btn-2">จะเสร็จเมื่อไร</button>
            </div>
          ))}
          {g.items.length === 0 ? <div className="empty">ไม่มีงานในกลุ่มนี้</div> : null}
        </Card>
      ))}
      <div className="alert i">
        <span>ℹ</span>
        <div>ปุ่ม “จะเสร็จเมื่อไร” ไม่ใช่การลงเวลาทำงาน — ใช้ให้ทีมรู้ลำดับเท่านั้น</div>
      </div>
    </>
  );
}
