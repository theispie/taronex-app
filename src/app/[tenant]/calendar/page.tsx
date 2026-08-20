import { Card, MockNotice, PageHead } from '@/components/ui';
import { TASKS } from '@/mock/data';

/**
 * หน้าจอ 25 · ปฏิทินกำหนดส่ง
 * แสดงรหัสการ์ดไม่ใช่ชื่อเต็ม เพราะช่องวันหนึ่งใส่ข้อความยาวไม่ได้ และรหัสจำง่ายกว่า
 * ปฏิทินนี้คือกำหนดส่งของการ์ด คนละอันกับปฏิทินวันทำการที่ใช้คำนวณ SLA
 * ลากเลื่อน = PATCH /tasks/:id { due_date } · เลื่อนเกินกำหนดส่งโปรเจกต์ให้เตือนแต่ไม่ห้าม
 */
const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
const PLACED: Record<number, string[]> = {
  19: ['ACM-134'],
  21: ['ACM-138', 'ACM-139'],
  25: ['ACM-136'],
  28: ['ACM-140'],
};

export default function CalendarPage() {
  const days = Array.from({ length: 35 }, (_, i) => i - 3); // เริ่มกลางสัปดาห์ให้เหมือนเดือนจริง
  return (
    <>
      <MockNotice />
      <PageHead
        title="ปฏิทินกำหนดส่ง"
        desc="สิงหาคม 2569 · ลากการ์ดเพื่อเลื่อนกำหนดส่งได้"
        right={
          <div className="segsw">
            <button type="button">‹</button>
            <button type="button" className="on">
              เดือนนี้
            </button>
            <button type="button">›</button>
          </div>
        }
      />
      <Card>
        <div className="cal">
          {DOW.map((d) => (
            <div key={d} className="cal-h">
              {d}
            </div>
          ))}
          {days.map((d) => (
            <div key={d} className={`cal-d${d < 1 || d > 31 ? ' cal-out' : ''}`}>
              <span className="cal-n mn">{d >= 1 && d <= 31 ? d : ''}</span>
              {(PLACED[d] ?? []).map((c) => (
                <span key={c} className="cal-tk mn">
                  {c}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Card>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>
          ปฏิทินนี้คือกำหนดส่งของการ์ด — คนละอันกับปฏิทินวันทำการที่ใช้คำนวณนาฬิกา SLA (
          {TASKS.filter((t) => t.dueDate).length} การ์ดมีกำหนดส่ง)
        </div>
      </div>
    </>
  );
}
