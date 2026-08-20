import Link from 'next/link';
import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS, PROJECTS } from '@/mock/data';

/**
 * หน้าจอ 46 (รายวัน) · 47 (รายสัปดาห์ ตามโปรเจกต์) · 48 (รายเดือน) · 49 (แต่ละบทบาทเห็นอะไร)
 *
 * ทุกข้อมูลมาจาก task_events + comments ที่บันทึกอยู่แล้ว ไม่มีตารางใหม่ ไม่มีใครต้องกรอกอะไรเพิ่ม
 * กฎข้อ 9 — ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ ห้ามมีตัวเลขที่ PM เห็นแต่คนอื่นไม่เห็น
 * คนที่ไม่มีความเคลื่อนไหวเป็นสีเทา ไม่ใช่สีแดง และแสดงว่าเขาถือการ์ดอะไรอยู่ควบคู่เสมอ
 */
const DAY_EVENTS = [
  { at: '09:12', who: 'u1', text: 'ย้าย ACM-138 ไป รอตรวจ' },
  { at: '09:40', who: 'u2', text: 'คอมเมนต์ใน ACM-133' },
  { at: '10:24', who: 'u1', text: 'ตีกลับ ACM-138 พร้อมเหตุผล' },
  { at: '11:05', who: 'u3', text: 'ย้าย ACM-134 ไป กำลังทำ' },
  { at: '14:20', who: 'u2', text: 'บันทึกความคืบหน้าใน ACM-136' },
  { at: '16:02', who: 'u4', text: 'สร้าง ACM-140' },
];
const WEEK = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์'];
/** 31 วันของเดือน — ชุดคงที่ ประกาศไว้ตรงนี้ให้ key ของแต่ละช่องนิ่ง */
const HEAT_DAYS = Array.from({ length: 31 }, (_, i) => i);
const ROLE_VIEW = [
  ['เจ้าของ', 'ทุกโปรเจกต์ในที่ทำงาน', 'ทุกคน', 'กดได้ทุกปุ่ม'],
  ['สมาชิก', 'ทุกโปรเจกต์', 'ตัวเองเป็นค่าเริ่มต้น', 'กดได้เฉพาะการ์ดที่ร่วมงานได้'],
  ['ผู้ชม', 'ทุกโปรเจกต์', 'ทุกคน', 'ไม่มีปุ่มให้กด'],
  ['แขก', 'เฉพาะโปรเจกต์ที่ถูกเชิญ', 'เฉพาะในโปรเจกต์นั้น', 'กดได้เฉพาะที่ได้รับสิทธิ์'],
];

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ range?: string; group?: string }>;
}) {
  const { tenant } = await params;
  const { range = 'day', group } = await searchParams;
  const base = `/${tenant}/activity`;
  const byProject = group === 'project';

  return (
    <>
      <MockNotice />
      <PageHead
        title="กิจกรรม"
        desc="สร้างจากสิ่งที่เกิดขึ้นจริงในระบบ ไม่มีใครต้องกรอกเพิ่ม"
        right={
          <>
            <div className="segsw">
              <Link href={`${base}?range=day`} className={range === 'day' ? 'on' : ''}>
                รายวัน
              </Link>
              <Link href={`${base}?range=week`} className={range === 'week' ? 'on' : ''}>
                รายสัปดาห์
              </Link>
              <Link href={`${base}?range=month`} className={range === 'month' ? 'on' : ''}>
                รายเดือน
              </Link>
            </div>
            <div className="segsw">
              <Link href={`${base}?range=${range}`} className={!byProject ? 'on' : ''}>
                ตามคน
              </Link>
              <Link href={`${base}?range=${range}&group=project`} className={byProject ? 'on' : ''}>
                ตามโปรเจกต์
              </Link>
            </div>
          </>
        }
      />

      {range === 'day' ? (
        <Card className="mb">
          <div className="card-h">
            <b>วันนี้ 19 สิงหาคม 2569</b>
            <div className="r">
              <span className="sub">แตะ 5 การ์ด · 2 โปรเจกต์</span>
            </div>
          </div>
          <div className="card-b" style={{ display: 'grid', gap: 10 }}>
            {DAY_EVENTS.map((e) => {
              const m = MEMBERS.find((x) => x.id === e.who);
              return (
                <div key={`${e.at}-${e.who}`} className="evrow">
                  <span className="mn evt">{e.at}</span>
                  <Avatar member={m} size="sm" />
                  <span style={{ fontSize: 13 }}>
                    <b>{m?.name}</b> {e.text}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : range === 'week' ? (
        <Card className="mb">
          <div className="card-h">
            <b>สัปดาห์นี้</b>
            <div className="r">
              <span className="sub">{byProject ? 'จัดกลุ่มตามโปรเจกต์' : 'จัดกลุ่มตามคน'}</span>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 170 }}>{byProject ? 'โปรเจกต์' : 'คน'}</th>
                {WEEK.map((d) => (
                  <th key={d} style={{ textAlign: 'center' }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(byProject ? PROJECTS : MEMBERS.filter((m) => m.role !== 'viewer')).map((x, ri) => (
                <tr key={'id' in x ? x.id : ri}>
                  <td style={{ fontWeight: 500 }}>{'name' in x ? x.name : ''}</td>
                  {WEEK.map((d, ci) => {
                    const n = (ri + ci) % 4;
                    return (
                      <td key={d} style={{ textAlign: 'center' }}>
                        {n === 0 ? (
                          <span className="sub" title="ไม่มีความเคลื่อนไหว">
                            —
                          </span>
                        ) : (
                          <span className={`heat heat-${n}`} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-b">
            <div className="hint">
              ช่องสีเทาคือข้อมูล ไม่ใช่ที่ว่าง — เห็นวันที่นิ่งได้ทันทีโดยไม่ต้องนับ · “ยังไม่เริ่ม” ต่างจาก “—”
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb">
          <div className="card-h">
            <b>สิงหาคม 2569</b>
          </div>
          <div className="card-b">
            <div className="alert i" style={{ marginBottom: 14 }}>
              <span>ℹ</span>
              <div>หน้านี้ไม่ใช่การวัดปริมาณงาน — ใช้ดูแนวโน้มว่าช่วงไหนงานเดิน ช่วงไหนนิ่ง ไม่ได้ใช้เทียบคน</div>
            </div>
            <div className="heatcal">
              {HEAT_DAYS.map((d) => (
                <span
                  key={d}
                  className={`heat heat-${d % 5 === 0 ? 0 : d % 4}`}
                  title={`${d + 1} ส.ค.`}
                />
              ))}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              ความเข้ม 4 ระดับ ไม่มีตัวเลขกำกับ · วันที่ไม่มีความเคลื่อนไหว 5 วัน
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="card-h">
          <b>แต่ละบทบาทเห็นอะไร</b>
          <div className="r">
            <span className="sub">หน้าจอ 49</span>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>บทบาท</th>
              <th>ขอบเขตข้อมูล</th>
              <th>ค่าเริ่มต้นตัวกรอง</th>
              <th>ปุ่มที่กดได้</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_VIEW.map((r) => (
              <tr key={r[0]}>
                <td>
                  <span className={`chip ${r[0] === 'เจ้าของ' ? 'st-review' : ''}`}>{r[0]}</span>
                </td>
                <td className="sub">{r[1]}</td>
                <td className="sub">{r[2]}</td>
                <td className="sub">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card-b">
          <div className="alert w">
            <span>⚠</span>
            <div>
              หน้าเดียว โค้ดชุดเดียว ทุกบทบาทเรียก endpoint เดียวกัน ต่างแค่ขอบเขตที่
              <code>resolveAccess()</code> กรองให้
              <br />
              ทันทีที่ PM เห็นตัวเลขที่คนอื่นไม่เห็น หน้านี้จะกลายเป็นเครื่องมือประเมินผล — ห้ามเด็ดขาด
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
