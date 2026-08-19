import { notFound } from 'next/navigation';
import { MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { TASKS, projectByKey } from '@/mock/data';

/**
 * หน้าจอ 19 · Timeline / Gantt
 * ไม่มีเส้นเชื่อมความสัมพันธ์ระหว่างงาน — ตัดออกโดยตั้งใจ
 * แท่งคำนวณจากการ์ดลูก · งานหลักที่ไม่มีการ์ดเป็นแท่งเส้นประ · เลนงานนอกแผนอยู่ล่างสุด
 * render เป็น SVG ในเบราว์เซอร์ + @media print ให้พอดี A4 แนวนอน
 * (ยังไม่ทำส่งออกฝั่งเซิร์ฟเวอร์ — resvg กิน RAM 200–400 MB ต่อครั้ง)
 */
const WEEKS = 10;
const BARS = [
  { name: 'ระบบสมาชิก', start: 0, len: 3, pct: 100, color: 'var(--brand)' },
  { name: 'หน้าร้านค้า', start: 2, len: 4, pct: 45, color: 'var(--brand)' },
  { name: 'ชำระเงิน', start: 5, len: 3, pct: 10, color: 'var(--brand)' },
  { name: 'เชื่อมระบบบัญชี', start: 8, len: 2, pct: 0, hollow: true },
];

export default async function TimelinePage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  const outside = TASKS.filter((t) => !t.featureId);

  return (
    <>
      <MockNotice />
      <PageHead
        title={p.name}
        desc={`${p.key} · Timeline ตามงานหลัก`}
        right={<button type="button" className="btn btn-2 btn-sm">พิมพ์ / บันทึกเป็น PDF</button>}
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />

      <div className="tl">
        <div className="tlh">
          <div className="l">งานหลัก</div>
          <div className="wks">
            {Array.from({ length: WEEKS }, (_, i) => (
              <div key={i} className="w">ส{i + 1}</div>
            ))}
          </div>
        </div>

        {BARS.map((b) => (
          <div key={b.name} className="tlr">
            <div className="l"><span className="nm">{b.name}</span></div>
            <div className="lane">
              {Array.from({ length: WEEKS }, (_, i) => (
                <div key={i} className="gl" style={{ left: `${(i / WEEKS) * 100}%` }} />
              ))}
              <div className="now" style={{ left: '52%' }} />
              <div
                className={`bar${b.hollow ? ' hollow' : ''}`}
                style={{
                  left: `${(b.start / WEEKS) * 100}%`,
                  width: `${(b.len / WEEKS) * 100}%`,
                  background: b.hollow ? undefined : b.color,
                }}
              >
                {!b.hollow ? <div className="fl" style={{ width: `${b.pct}%` }} /> : null}
                <span>{b.hollow ? 'ยังไม่มีการ์ด' : `${b.pct}%`}</span>
              </div>
            </div>
          </div>
        ))}

        <div className="tlr">
          <div className="l"><span className="nm" style={{ color: 'var(--danger)' }}>งานนอกแผน</span>
            <span className="ct">{outside.length}</span></div>
          <div className="lane">
            <div className="now" style={{ left: '52%' }} />
            <div className="bar m" style={{ left: '38%', width: '22%', background: 'var(--danger)' }}>
              <span>{outside.length} การ์ด</span>
            </div>
          </div>
        </div>
      </div>

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>เลนสีแดงล่างสุดคืองานที่ไม่ได้อยู่ในแผน เห็นทันทีว่ากินเวลาไปแค่ไหน
          <br />ส่งออกเป็นไฟล์ใช้ปุ่มพิมพ์ของเบราว์เซอร์ — ไม่มีลิงก์สาธารณะให้ลูกค้า
          เพื่อลดพื้นที่ที่ข้อมูลภายในจะหลุด</div>
      </div>
    </>
  );
}
