import Link from 'next/link';
import { PORTAL_STEPS } from '@/mock/data';

/**
 * หน้าจอ 32 · พอร์ทัล — ติดตามเรื่อง
 * ไม่มีกล่องสนทนา — ลูกค้าดูสถานะได้อย่างเดียว การคุยกันยังใช้โทรศัพท์หรืออีเมลตามเดิม
 * แสดงเฉพาะวันที่ ไม่มีเวลา และไม่มีตัวเลข SLA ใดๆ เพื่อไม่ให้กลายเป็นเครื่องมือจับผิด
 * "คาดว่าแล้วเสร็จ" ไม่ใช่ "ครบกำหนด SLA" — คำหลังฟังเหมือนสัญญาที่ผูกมัด
 * ไทม์ไลน์แปลงจาก task_events → 5 ขั้นที่ลูกค้าเข้าใจ
 */
export default async function PortalIssue({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  return (
    <>
      <p style={{ marginBottom: 12 }}>
        <Link href={`/portal/${slug}`} className="auth-link">
          ← กลับไปรายการ
        </Link>
      </p>
      <div className="pw-head">
        <div>
          <span className="mn sub">{code}</span>
          <h1>ฟอร์มติดต่อส่งอีเมลไม่ออก</h1>
          <p className="sub">แจ้งเมื่อ 14 ส.ค. 2569 · คาดว่าแล้วเสร็จ 20 ส.ค. 2569</p>
        </div>
      </div>

      <div className="pw-card mb">
        <div className="card-b">
          <div className="steps">
            {PORTAL_STEPS.map((s, i) => (
              <div
                key={s.label}
                className={`step${s.done ? ' done' : ''}${s.current ? ' cur' : ''}`}
              >
                <span className="dotstep">{s.done ? '✓' : i + 1}</span>
                <div>
                  <div className="step-l">{s.label}</div>
                  <div className="sub mn" style={{ fontSize: 11.5 }}>
                    {s.date || 'ยังไม่ถึงขั้นนี้'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pw-card">
        <div className="card-b">
          <b style={{ fontSize: 13.5 }}>รายละเอียดที่แจ้งไว้</b>
          <p className="sub" style={{ marginTop: 8 }}>
            กดส่งฟอร์มติดต่อจากหน้าเว็บแล้วไม่มีอีเมลเข้ามาที่ sales@thongthai.co.th ลองแล้วทั้งจากคอมและมือถือ
            เกิดตั้งแต่สัปดาห์ที่แล้ว
          </p>
          <p className="hint" style={{ marginTop: 14 }}>
            มีข้อมูลเพิ่มเติม? ติดต่อทีมงานได้ที่ 02-123-4567 หรือตอบกลับอีเมลแจ้งเตือนได้เลย
          </p>
        </div>
      </div>
    </>
  );
}
