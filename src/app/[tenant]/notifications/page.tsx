import { Card, MockNotice, PageHead } from '@/components/ui';
import { NOTIFICATIONS, type Notification } from '@/mock/data';

/**
 * หน้าจอ 35 · ศูนย์แจ้งเตือน
 * แสดงข้อความของเหตุการณ์ด้วย (เหตุผลตีกลับ คอมเมนต์ที่พูดถึง) ไม่ใช่แค่บอกว่ามีเหตุการณ์
 * รายการที่ยังไม่อ่านใช้พื้นหลังอ่อน ไม่ใช่แค่จุดเล็กๆ ทางขวา
 * สร้างจาก task_events + sla_clock ไม่มีตารางเหตุการณ์แยก
 */
const KIND: Record<Notification['kind'], { label: string; cls: string }> = {
  assigned: { label: 'มอบหมาย', cls: 'st-todo' },
  transferred: { label: 'โอนงาน', cls: 'st-todo' },
  rejected: { label: 'ตีกลับ', cls: 'st-doing' },
  mentioned: { label: 'พูดถึงคุณ', cls: 'st-review' },
  sla_warning: { label: 'ใกล้ครบกำหนด', cls: 'st-blocked' },
  client_reported: { label: 'ลูกค้าแจ้ง', cls: 'st-done' },
};

export default function NotificationsPage() {
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  return (
    <>
      <MockNotice />
      <PageHead
        title="การแจ้งเตือน"
        desc={`ยังไม่ได้อ่าน ${unread} รายการ`}
        right={
          <button type="button" className="btn btn-2 btn-sm">
            ทำเครื่องหมายว่าอ่านทั้งหมด
          </button>
        }
      />
      <Card>
        {NOTIFICATIONS.map((n) => {
          const k = KIND[n.kind];
          return (
            <div key={n.id} className={`nrow${n.unread ? ' nrow-un' : ''}`}>
              <span className={`chip ${k.cls}`}>{k.label}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                <div className="sub" style={{ fontSize: 12.5 }}>
                  {n.body}
                </div>
              </div>
              <span className="sub mn" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                {n.at}
              </span>
            </div>
          );
        })}
      </Card>
      <div className="hint" style={{ marginTop: 10 }}>
        เวอร์ชันนี้ส่งอีเมลจริง 3 ชนิด — มอบหมายงาน · ตีกลับ · พูดถึงในคอมเมนต์
      </div>
    </>
  );
}
