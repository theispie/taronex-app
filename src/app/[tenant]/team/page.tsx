import Link from 'next/link';
import { Avatar, Card, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS, PROJECTS, TASKS } from '@/mock/data';
import { taskCode } from '@/lib/types';

/**
 * หน้าจอ 26 · ภาพรวมทีม (ตอนนี้)  ·  27 · ช่วงเวลา (เมื่อ ?view=range)
 * สองโหมดตอบคนละคำถาม — "ตอนนี้" ใครถืออะไรอยู่ · "ช่วงเวลา" ใครถูกจองช่วงไหน
 * ค้นหาชื่อและกรองตำแหน่งงานอยู่ตรงนี้ — ประโยชน์จริงข้อเดียวของ job_title
 * ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ (กฎข้อ 9)
 */
const JOB: Record<string, string> = {
  pm: 'PM', ba: 'BA', dev: 'Dev', qa: 'QA', design: 'Design', other: 'อื่นๆ',
};
const PCOLOR = ['var(--brand)', 'var(--ws)', 'var(--p-high)'];

export default async function TeamPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { tenant } = await params;
  const { view } = await searchParams;
  const range = view === 'range';
  const people = MEMBERS.filter((m) => m.role !== 'viewer' && m.role !== 'guest');

  return (
    <>
      <MockNotice />
      <PageHead
        title="ภาพรวมทีม"
        desc={range ? 'ใครถูกจองช่วงไหน' : 'ตอนนี้ใครถืออะไรอยู่'}
        right={
          <div className="segsw">
            <Link href={`/${tenant}/team`} className={!range ? 'on' : ''}>ตอนนี้</Link>
            <Link href={`/${tenant}/team?view=range`} className={range ? 'on' : ''}>ช่วงเวลา</Link>
          </div>
        }
      />

      <div className="filters mb">
        <input className="inp" placeholder="ค้นหาชื่อ…" style={{ maxWidth: 200 }} />
        <select className="inp" style={{ maxWidth: 150 }}>
          <option>ทุกตำแหน่งงาน</option>
          {Object.values(JOB).map((j) => <option key={j}>{j}</option>)}
        </select>
      </div>

      {range ? (
        <>
          <Card>
            <div className="card-h"><b>สัปดาห์นี้</b>
              <div className="r"><div className="segsw">
                <button type="button">วัน</button>
                <button type="button" className="on">สัปดาห์</button>
                <button type="button">เดือน</button>
              </div></div>
            </div>
            <div className="tl">
              <div className="tlh"><div className="l">คน</div>
                <div className="wks">{['จ', 'อ', 'พ', 'พฤ', 'ศ'].map((d) =>
                  <div key={d} className="w">{d}</div>)}</div>
              </div>
              {people.map((m, i) => (
                <div key={m.id} className="tlr">
                  <div className="l"><Avatar member={m} size="sm" />
                    <span className="nm">{m.name}</span></div>
                  <div className="lane">
                    <div className="bar m" style={{
                      left: `${(i % 3) * 18}%`, width: `${30 + (i % 2) * 20}%`,
                      background: PCOLOR[i % PCOLOR.length],
                    }}><span>{PROJECTS[i % PROJECTS.length]?.key}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div className="alert w" style={{ marginTop: 14 }}>
            <span>⚠</span>
            <div>หน้านี้บอกว่าใครถูกจองช่วงไหน ไม่ได้บอกว่าใครทำงานหนักกว่ากัน
              สีของแท่งคือสีโปรเจกต์ ทำให้เห็นว่าใครถูกดึงไปหลายโปรเจกต์พร้อมกัน</div>
          </div>
        </>
      ) : (
        <div className="grid2">
          {people.map((m) => {
            const held = TASKS.filter((t) => t.assigneeId === m.id && t.status !== 'done');
            return (
              <Card key={m.id}>
                <div className="card-h">
                  <Avatar member={m} />
                  <div style={{ minWidth: 0 }}><b>{m.name}</b>
                    <div className="sub" style={{ fontSize: 11.5 }}>{JOB[m.jobTitle]}</div></div>
                  <div className="r"><span className="sub">ถืออยู่ {held.length} ใบ</span></div>
                </div>
                {held.length > 0 ? held.map((t) => (
                  <div key={t.id} className="row">
                    <span className="cd mn">{taskCode(t)}</span>
                    <span className="row-title">{t.title}</span>
                    <HeldTag days={t.heldDays} />
                  </div>
                )) : <div className="empty">ไม่มีความเคลื่อนไหว</div>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
