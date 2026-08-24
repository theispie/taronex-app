'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 46 (รายวัน) · 47 (รายสัปดาห์ ตามโปรเจกต์) · 48 (รายเดือน) · 49 (แต่ละบทบาทเห็นอะไร)
 *
 * ทุกข้อมูลมาจาก `task_events` + `comments` ที่บันทึกอยู่แล้ว
 * ไม่มีตารางใหม่ ไม่มีใครต้องกรอกอะไรเพิ่ม
 *
 * ═══ กฎข้อ 9 ═══
 * ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ และห้ามมีตัวเลขที่ PM เห็นแต่คนอื่นไม่เห็น
 *
 * หน้านี้**ไม่มีตัวเลขให้แสดงตั้งแต่แรก** — API ตัดจำนวนเป็นระดับความเข้ม 0–3
 * มาให้แล้วตั้งแต่ชั้นข้อมูล ต่อให้เปิด DevTools ก็ไม่เห็นจำนวนดิบ
 *
 * แถวคนที่ไม่มีความเคลื่อนไหวเป็นสีเทา ไม่ใช่สีแดง และบอกว่าเขาถือการ์ดอะไรอยู่ควบคู่เสมอ
 * ใช้คำว่า "ไม่มีความเคลื่อนไหว" ไม่ใช่ "ไม่มีผลงาน" — คำหลังตัดสินคน คำแรกบอกข้อเท็จจริง
 */
type Range = 'day' | 'week' | 'month';

interface Data {
  range: Range;
  group: 'person' | 'project';
  from: string;
  to: string;
  labels: string[];
  events: { at: string; actorId: string | null; actorName: string | null; text: string }[];
  rows: { key: string; name: string; cells: number[]; holding: string[] }[];
  overall: number[];
  touchedTasks: number;
  touchedProjects: number;
}

interface MyTasks {
  late: { id: string; code: string; title: string }[];
  dueToday: { id: string; code: string; title: string }[];
  stale: { id: string; code: string; title: string }[];
  rest: { id: string; code: string; title: string }[];
}

const ROLE_VIEW = [
  ['เจ้าของ', 'ทุกโปรเจกต์ในที่ทำงาน', 'ทุกคน', 'กดได้ทุกปุ่ม'],
  ['สมาชิก', 'ทุกโปรเจกต์', 'ตัวเองเป็นค่าเริ่มต้น', 'กดได้เฉพาะการ์ดที่ร่วมงานได้'],
  ['ผู้ชม', 'ทุกโปรเจกต์', 'ทุกคน', 'ไม่มีปุ่มให้กด'],
  ['แขก', 'เฉพาะโปรเจกต์ที่ถูกเชิญ', 'เฉพาะในโปรเจกต์นั้น', 'กดได้เฉพาะที่ได้รับสิทธิ์'],
];

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function thaiRange(from: string, to: string, range: Range): string {
  const f = new Date(`${from}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'UTC', year: 'numeric' };
  if (range === 'month') {
    return f.toLocaleDateString('th-TH', { ...opts, month: 'long' });
  }
  if (range === 'day') {
    return f.toLocaleDateString('th-TH', { ...opts, day: 'numeric', month: 'long' });
  }
  const t = new Date(`${to}T00:00:00Z`);
  return `${f.toLocaleDateString('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' })} – ${t.toLocaleDateString('th-TH', { ...opts, day: 'numeric', month: 'short' })}`;
}

export default function ActivityPage() {
  const tenant = String(useParams().tenant ?? '');
  const [range, setRange] = useState<Range>('day');
  const [byProject, setByProject] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // กล่องบันทึกความคืบหน้า — ลงเป็นคอมเมนต์ภายใน ไม่ออกไปถึงลูกค้า (กฎข้อ 6)
  const [mine, setMine] = useState<{ id: string; code: string; title: string }[]>([]);
  const [taskId, setTaskId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    try {
      const group = byProject ? 'project' : 'person';
      setData(await api.get<Data>(`/t/${tenant}/activity?range=${range}&group=${group}`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, range, byProject]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const m = await api.get<MyTasks>(`/t/${tenant}/me/tasks`);
        setMine([...m.late, ...m.dueToday, ...m.stale, ...m.rest]);
      } catch {
        // ไม่มีการ์ดของตัวเองก็ไม่เป็นไร กล่องบันทึกจะไม่ขึ้นเอง
      }
    })();
  }, [tenant]);

  async function saveProgress() {
    setSaving(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/tasks/${taskId}/progress`, { body: note });
      setNote('');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHead
        title="กิจกรรม"
        desc="สร้างจากสิ่งที่เกิดขึ้นจริงในระบบ ไม่มีใครต้องกรอกเพิ่ม"
        right={
          <>
            <div className="segsw">
              {(['day', 'week', 'month'] as Range[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={range === r ? 'on' : ''}
                  onClick={() => setRange(r)}
                >
                  {r === 'day' ? 'รายวัน' : r === 'week' ? 'รายสัปดาห์' : 'รายเดือน'}
                </button>
              ))}
            </div>
            {range !== 'day' ? (
              <div className="segsw">
                <button
                  type="button"
                  className={!byProject ? 'on' : ''}
                  onClick={() => setByProject(false)}
                >
                  ตามคน
                </button>
                <button
                  type="button"
                  className={byProject ? 'on' : ''}
                  onClick={() => setByProject(true)}
                >
                  ตามโปรเจกต์
                </button>
              </div>
            ) : null}
          </>
        }
      />

      {err ? <div className="alert e">{err}</div> : null}
      {!data && !err ? (
        <Card className="mb">
          <div className="empty">กำลังโหลด…</div>
        </Card>
      ) : null}

      {data && range === 'day' ? (
        <Card className="mb">
          <div className="card-h">
            <b>{thaiRange(data.from, data.to, 'day')}</b>
            <div className="r">
              <span className="sub">
                แตะ {data.touchedTasks} การ์ด · {data.touchedProjects} โปรเจกต์
              </span>
            </div>
          </div>
          <div className="card-b" style={{ display: 'grid', gap: 10 }}>
            {data.events.length === 0 ? (
              <div className="empty">ไม่มีความเคลื่อนไหวในวันนี้</div>
            ) : (
              data.events.map((e) => (
                <div key={`${e.at}-${e.text}`} className="evrow">
                  <span className="mn evt">{hhmm(e.at)}</span>
                  <Avatar
                    member={
                      e.actorId
                        ? {
                            id: e.actorId,
                            name: e.actorName ?? '',
                            initials: (e.actorName ?? '?').slice(0, 2),
                            email: '',
                            role: 'member',
                            jobTitle: 'other',
                            active: true,
                          }
                        : undefined
                    }
                    size="sm"
                  />
                  <span style={{ fontSize: 13 }}>
                    <b>{e.actorName ?? 'ลูกค้า'}</b> {e.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      ) : null}

      {range === 'day' && mine.length > 0 ? (
        <Card className="mb">
          <div className="card-h">
            <b>บันทึกความคืบหน้า</b>
            <div className="r">
              <span className="sub">เห็นเฉพาะคนในทีม</span>
            </div>
          </div>
          <div className="card-b" style={{ display: 'grid', gap: 8 }}>
            <select
              className="inp"
              aria-label="เลือกการ์ด"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">เลือกการ์ดที่ถืออยู่…</option>
              {mine.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.title}
                </option>
              ))}
            </select>
            <input
              className="inp"
              placeholder="ทำถึงไหนแล้ว ติดอะไรอยู่"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div>
              <button
                type="button"
                className="btn btn-2 btn-sm"
                disabled={saving || !taskId || !note.trim()}
                onClick={() => void saveProgress()}
              >
                บันทึก
              </button>
            </div>
            <div className="hint">
              ลงเป็นบันทึกภายในเสมอ — ถ้าอยากบอกลูกค้า ให้ไปกดสถานะที่หน้าทิกเก็ตงานประกัน
              ซึ่งเป็นคนละการกระทำและมีคนรับผิดชอบชัดเจนว่าใครเป็นคนบอก
            </div>
          </div>
        </Card>
      ) : null}

      {data && range === 'week' ? (
        <Card className="mb">
          <div className="card-h">
            <b>{thaiRange(data.from, data.to, 'week')}</b>
            <div className="r">
              <span className="sub">{byProject ? 'จัดกลุ่มตามโปรเจกต์' : 'จัดกลุ่มตามคน'}</span>
            </div>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 200 }}>{byProject ? 'โปรเจกต์' : 'คน'}</th>
                {data.labels.map((d) => (
                  <th key={d} style={{ textAlign: 'center' }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{row.name}</div>
                    {row.holding.length > 0 ? (
                      <div className="sub mn" style={{ fontSize: 11.5 }}>
                        ถืออยู่ {row.holding.join(' · ')}
                      </div>
                    ) : null}
                  </td>
                  {row.cells.map((n, i) => (
                    <td key={data.labels[i] ?? i} style={{ textAlign: 'center' }}>
                      {n === 0 ? (
                        <span className="sub" title="ไม่มีความเคลื่อนไหว">
                          —
                        </span>
                      ) : (
                        <span className={`heat heat-${n}`} />
                      )}
                    </td>
                  ))}
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
      ) : null}

      {data && range === 'month' ? (
        <Card className="mb">
          <div className="card-h">
            <b>{thaiRange(data.from, data.to, 'month')}</b>
          </div>
          <div className="card-b">
            <div className="alert i" style={{ marginBottom: 14 }}>
              <span>ℹ</span>
              <div>หน้านี้ไม่ใช่การวัดปริมาณงาน — ใช้ดูแนวโน้มว่าช่วงไหนงานเดิน ช่วงไหนนิ่ง ไม่ได้ใช้เทียบคน</div>
            </div>
            <div className="heatcal">
              {data.overall.map((n, i) => (
                <span
                  key={data.labels[i] ?? i}
                  className={`heat heat-${n}`}
                  title={`${data.labels[i]} · ${n === 0 ? 'ไม่มีความเคลื่อนไหว' : 'มีความเคลื่อนไหว'}`}
                />
              ))}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              ความเข้ม 4 ระดับ ไม่มีตัวเลขกำกับ · วันที่ไม่มีความเคลื่อนไหว{' '}
              {data.overall.filter((n) => n === 0).length} วัน
            </div>
          </div>
        </Card>
      ) : null}

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
