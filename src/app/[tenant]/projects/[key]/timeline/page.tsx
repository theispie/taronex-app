'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 19 · Timeline
 *
 * ═══ วาดเป็น SVG ในเบราว์เซอร์ ไม่ใช่แปลงที่เซิร์ฟเวอร์ ═══
 * `resvg` กิน RAM 200–400 MB ต่อครั้ง เครื่อง 1 GB รับไม่ไหวถ้ามีคนกดพร้อมกันสองคน
 * ใช้ `@media print` แทน เบราว์เซอร์บันทึกเป็น PDF ได้เอง
 * ใช้ RAM ของเซิร์ฟเวอร์เป็นศูนย์ และฟอนต์ไทยไม่มีทางเพี้ยนเพราะเป็นฟอนต์ของเครื่องคนใช้เอง
 *
 * ไม่มีเส้นเชื่อมความสัมพันธ์ระหว่างงาน — ตัดออกโดยตั้งใจ
 * ทีม 5–50 คนแทบไม่ได้ใช้ และมันดึงต้นทุนอีก 3–4 สัปดาห์
 *
 * เลนล่างสุดคืองานนอกแผน เห็นทันทีว่ากินเวลาไปแค่ไหน
 */
interface Lane {
  id: string;
  name: string;
  color: string;
  startsOn: string | null;
  endsOn: string | null;
  taskCount: number;
  doneCount: number;
  isUnplanned: boolean;
}
interface Timeline {
  projectKey: string;
  projectName: string;
  startsOn: string;
  dueOn: string;
  windowStart: string;
  windowEnd: string;
  lanes: Lane[];
}

const DAY = 86_400_000;
const LANE_H = 34;
const LABEL_W = 190;
const CHART_W = 720;
const TOP_H = 30;

const toTime = (d: string) => new Date(`${d}T00:00:00Z`).getTime();

/** เดือนไทยแบบย่อ ยกจากต้นแบบ ไม่ได้แปลใหม่ */
const MONTHS = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export default function TimelinePage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [tl, setTl] = useState<Timeline | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Timeline>(`/t/${tenant}/projects/${key}/timeline`)
      .then(setTl)
      .catch((e) => setErr(errorText(e)));
  }, [tenant, key]);

  const view = useMemo(() => {
    if (!tl) return null;
    const start = toTime(tl.windowStart);
    const end = toTime(tl.windowEnd);
    const span = Math.max(DAY, end - start);
    const x = (d: string) => ((toTime(d) - start) / span) * CHART_W;

    // เส้นแบ่งเดือน — ไม่ใช่เส้นแบ่งสัปดาห์ เพราะโปรเจกต์ยาวหลายเดือนแล้วเส้นจะถี่จนอ่านไม่ออก
    const ticks: { at: number; label: string }[] = [];
    const cur = new Date(start);
    cur.setUTCDate(1);
    while (cur.getTime() <= end) {
      if (cur.getTime() >= start) {
        ticks.push({
          at: ((cur.getTime() - start) / span) * CHART_W,
          label: `${MONTHS[cur.getUTCMonth()]} ${String(cur.getUTCFullYear() + 543).slice(-2)}`,
        });
      }
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }

    const today = Date.now();
    const nowX = today >= start && today <= end ? ((today - start) / span) * CHART_W : null;
    const dueX = x(tl.dueOn);

    return { x, ticks, nowX, dueX, height: TOP_H + tl.lanes.length * LANE_H + 10 };
  }, [tl]);

  return (
    <>
      <PageHead
        title={`${key} · Timeline`}
        desc={tl ? `${tl.lanes.length} เลน · ${tl.startsOn} → ${tl.dueOn}` : 'กำลังโหลด…'}
        right={
          <button
            type="button"
            className="btn btn-2 btn-sm noprint"
            onClick={() => window.print()}
            disabled={!tl}
          >
            พิมพ์ / บันทึกเป็น PDF
          </button>
        }
      />
      <div className="noprint">
        <ProjectTabs base={`/${tenant}/projects/${key}`} />
      </div>

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {tl && view ? (
        <>
          <div className="printarea card">
            <div className="card-b" style={{ overflowX: 'auto' }}>
              {/* พิมพ์ออกมาแล้วต้องรู้ว่าเป็นโปรเจกต์ไหน — บนจอมีหัวข้ออยู่แล้วจึงซ่อนไว้ */}
              <div className="printonly" style={{ marginBottom: 10 }}>
                <b>
                  {tl.projectKey} · {tl.projectName}
                </b>
                <div className="sub">
                  {tl.startsOn} → {tl.dueOn}
                </div>
              </div>

              <svg
                viewBox={`0 0 ${LABEL_W + CHART_W + 20} ${view.height}`}
                style={{ width: '100%', minWidth: 640, height: view.height }}
                role="img"
                aria-label={`Timeline ของโปรเจกต์ ${tl.projectKey}`}
              >
                <title>{`Timeline ${tl.projectKey}`}</title>

                {/* เส้นแบ่งเดือน */}
                {view.ticks.map((t) => (
                  <g key={t.label}>
                    <line
                      x1={LABEL_W + t.at}
                      y1={TOP_H - 8}
                      x2={LABEL_W + t.at}
                      y2={view.height - 6}
                      stroke="var(--line-2)"
                      strokeWidth={1}
                    />
                    <text
                      x={LABEL_W + t.at + 4}
                      y={16}
                      fontSize={11}
                      fill="var(--muted)"
                      fontFamily="var(--f)"
                    >
                      {t.label}
                    </text>
                  </g>
                ))}

                {/* กำหนดส่งของโปรเจกต์ */}
                <line
                  x1={LABEL_W + view.dueX}
                  y1={TOP_H - 12}
                  x2={LABEL_W + view.dueX}
                  y2={view.height - 6}
                  stroke="var(--danger)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />

                {/* วันนี้ */}
                {view.nowX !== null ? (
                  <line
                    x1={LABEL_W + view.nowX}
                    y1={TOP_H - 12}
                    x2={LABEL_W + view.nowX}
                    y2={view.height - 6}
                    stroke="var(--brand)"
                    strokeWidth={1.5}
                  />
                ) : null}

                {tl.lanes.map((lane, i) => {
                  const y = TOP_H + i * LANE_H;
                  const has = Boolean(lane.startsOn && lane.endsOn);
                  const x1 = has ? view.x(lane.startsOn as string) : 0;
                  const x2 = has ? view.x(lane.endsOn as string) : CHART_W;
                  const w = Math.max(6, x2 - x1);
                  const doneRatio = lane.taskCount > 0 ? lane.doneCount / lane.taskCount : 0;

                  return (
                    <g key={lane.id || 'unplanned'}>
                      <text
                        x={0}
                        y={y + 17}
                        fontSize={12}
                        fill={lane.isUnplanned ? 'var(--danger)' : 'var(--ink)'}
                        fontFamily="var(--f)"
                      >
                        {lane.name.length > 24 ? `${lane.name.slice(0, 23)}…` : lane.name}
                      </text>
                      <text
                        x={0}
                        y={y + 30}
                        fontSize={10}
                        fill="var(--faint)"
                        fontFamily="var(--fm)"
                      >
                        {lane.taskCount === 0
                          ? 'ยังไม่มีการ์ด'
                          : `${lane.doneCount}/${lane.taskCount} เสร็จ`}
                      </text>

                      {has ? (
                        <>
                          <rect
                            x={LABEL_W + x1}
                            y={y + 6}
                            width={w}
                            height={16}
                            rx={4}
                            fill={lane.color}
                            opacity={0.25}
                          />
                          {/* ส่วนที่เสร็จแล้ว — สัดส่วนจากจำนวนการ์ด ไม่ใช่จากเวลา */}
                          <rect
                            x={LABEL_W + x1}
                            y={y + 6}
                            width={Math.max(2, w * doneRatio)}
                            height={16}
                            rx={4}
                            fill={lane.color}
                          />
                        </>
                      ) : (
                        /* งานหลักที่ยังไม่มีการ์ด — แท่งเส้นประเต็มความกว้าง บอกว่ายังไม่ได้เริ่ม */
                        <rect
                          x={LABEL_W}
                          y={y + 6}
                          width={CHART_W}
                          height={16}
                          rx={4}
                          fill="none"
                          stroke="var(--line)"
                          strokeWidth={1}
                          strokeDasharray="5 4"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="sub" style={{ fontSize: 11.5 }}>
                  <span style={{ color: 'var(--brand)' }}>▌</span> วันนี้
                </span>
                <span className="sub" style={{ fontSize: 11.5 }}>
                  <span style={{ color: 'var(--danger)' }}>┊</span> กำหนดส่ง
                </span>
                <span className="sub" style={{ fontSize: 11.5 }}>
                  แท่งเส้นประ = งานหลักที่ยังไม่มีการ์ด
                </span>
              </div>
            </div>
          </div>

          <div className="alert i noprint" style={{ marginTop: 14 }}>
            <span>ℹ</span>
            <div>
              แท่งคำนวณจากการ์ดลูกเสมอ — งานหลักไม่มีช่องวันที่ให้กรอกเอง ·
              <b> ส่งออกเป็นรูป ไม่มีลิงก์สาธารณะให้ลูกค้า</b> เพื่อลดพื้นที่ที่ข้อมูลภายในจะหลุด
            </div>
          </div>
        </>
      ) : !err ? (
        <div className="hint">กำลังโหลด…</div>
      ) : null}
    </>
  );
}
