'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { TaskRow, type TaskRowData } from '@/components/task-row';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 26 · ภาพรวมทีม (ตอนนี้)  ·  27 (ช่วงเวลา)
 *
 * ═══ สองโหมดตอบคนละคำถาม ═══
 * "ตอนนี้" ตอบว่าใครถืออะไรอยู่ · "ช่วงเวลา" ตอบว่าใครถูกจองช่วงไหน
 *
 * ═══ กฎข้อ 9 ═══
 * ตัวเลขในหน้านี้เป็นภาระตอนนี้ ไม่ใช่ผลงานสะสม
 * ไม่มี "ปิดไปกี่ใบ" · ไม่มีความเร็ว · ไม่มีอะไรที่เอามาเทียบคนได้
 * และทุกคนเห็นเหมือนกันหมด ไม่มีตัวเลขลับสำหรับ PM
 *
 * ค้นชื่อและกรองตำแหน่งงานอยู่ตรงนี้ — นี่คือประโยชน์จริงข้อเดียวของ job_title
 */
interface TeamNow {
  userId: string;
  name: string;
  jobTitle: string;
  holding: number;
  cards: TaskRowData[];
  flags: string[];
}
interface RangeRow {
  userId: string;
  name: string;
  perDay: { date: string; holding: number }[];
}

const TITLES = ['ทั้งหมด', 'pm', 'ba', 'dev', 'qa', 'design', 'other'];

function TeamInner() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get('view') === 'range' ? 'range' : 'now';

  const [now, setNow] = useState<TeamNow[] | null>(null);
  const [range, setRange] = useState<RangeRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [title, setTitle] = useState('ทั้งหมด');

  // ช่วง 14 วันย้อนหลังถึงวันนี้
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);

  useEffect(() => {
    if (mode === 'now') {
      api
        .get<TeamNow[]>(`/t/${tenant}/team/overview`)
        .then(setNow)
        .catch((e) => setErr(errorText(e)));
    } else {
      api
        .get<RangeRow[]>(`/t/${tenant}/team/timeline?from=${from}&to=${to}`)
        .then(setRange)
        .catch((e) => setErr(errorText(e)));
    }
  }, [tenant, mode, from, to]);

  const shown = (now ?? []).filter(
    (p) =>
      (!nameFilter || p.name.includes(nameFilter)) && (title === 'ทั้งหมด' || p.jobTitle === title),
  );

  const days = range?.[0]?.perDay.map((d) => d.date) ?? [];

  return (
    <>
      <PageHead
        title="ภาพรวมทีม"
        desc={mode === 'now' ? 'ใครถืออะไรอยู่ตอนนี้' : `ใครถูกจองช่วงไหน · ${from} → ${to}`}
      />

      <div className="tabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={mode === 'now' ? 'on' : ''}
          onClick={() => router.push('?')}
        >
          ตอนนี้
        </button>
        <button
          type="button"
          className={mode === 'range' ? 'on' : ''}
          onClick={() => router.push('?view=range')}
        >
          ช่วงเวลา
        </button>
      </div>

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {mode === 'now' ? (
        <>
          <div className="ifilter">
            <input
              className="inp"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="ค้นชื่อ"
            />
            <select
              className="inp"
              style={{ width: 'auto' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="sub">แสดง {shown.length} คน</span>
          </div>

          {shown.map((p) => (
            <Card className="mb" key={p.userId}>
              <div className="card-h">
                <Avatar
                  member={{
                    id: p.userId,
                    name: p.name,
                    initials: p.name.slice(0, 2),
                    email: '',
                    role: 'member',
                    jobTitle: 'other',
                    active: true,
                  }}
                  size="sm"
                />
                <b>{p.name}</b>
                <span className="sub mn">{p.jobTitle}</span>
                <div className="r">
                  {p.flags.map((f) => (
                    <span key={f} className="tag hold">
                      {f}
                    </span>
                  ))}
                  <span className="chip">ถืออยู่ {p.holding} ใบ</span>
                </div>
              </div>
              <div className="card-b">
                {p.cards.length === 0 ? (
                  <div className="empty">ยังไม่มีการ์ดที่ถืออยู่</div>
                ) : (
                  p.cards.map((c) => (
                    <TaskRow key={c.id} task={c} tenant={tenant} showAssignee={false} />
                  ))
                )}
              </div>
            </Card>
          ))}

          <div className="alert i">
            <span>ℹ</span>
            <div>
              ตัวเลขในหน้านี้บอก<b>ภาระตอนนี้</b> ไม่ใช่ผลงานสะสม — ไม่มี “ปิดไปกี่ใบ” และจะไม่มี
              เพราะเป็นตัวเลขที่เอามาเรียงลำดับคนได้ ทุกคนเห็นหน้านี้เหมือนกันหมด
            </div>
          </div>
        </>
      ) : (
        <Card>
          <div className="card-b" style={{ overflowX: 'auto' }}>
            {range === null ? (
              <div className="hint">กำลังโหลด…</div>
            ) : range.length === 0 ? (
              <div className="empty">ไม่มีข้อมูลในช่วงนี้</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    {days.map((d) => (
                      <th key={d} className="mn" style={{ fontSize: 10.5 }}>
                        {d.slice(5)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {range.map((r) => (
                    <tr key={r.userId}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      {r.perDay.map((d) => (
                        <td
                          key={d.date}
                          className="mn"
                          style={{
                            textAlign: 'center',
                            // เข้มขึ้นตามภาระ — ไม่ใช่คะแนน แค่ให้เห็นว่าช่วงไหนแน่น
                            background:
                              d.holding > 0
                                ? `rgba(91,91,214,${Math.min(0.4, d.holding * 0.1)})`
                                : undefined,
                          }}
                        >
                          {d.holding || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="hint" style={{ marginTop: 10 }}>
              ตัวเลขคือจำนวนการ์ดที่ถืออยู่ ณ วันนั้น อ่านย้อนหลังจากประวัติการ์ด ไม่ใช่จำนวนที่ทำเสร็จ
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="hint">กำลังโหลด…</div>}>
      <TeamInner />
    </Suspense>
  );
}
