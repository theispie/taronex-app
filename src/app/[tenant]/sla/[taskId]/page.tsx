'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 39 · ทิกเก็ตงานประกัน
 *
 * ═══ สองนาฬิกาที่ไม่เกี่ยวกัน และนั่นคือเรื่องดี ═══
 * **นาฬิกา SLA** เดินตั้งแต่ลูกค้ากดส่ง วัดเวลาจริงที่ลูกค้ารอ
 * **สถานะที่ลูกค้าเห็น** ขยับเมื่อมีคนกดเท่านั้น ไม่ผูกกับบอร์ดและไม่ผูกกับนาฬิกา
 * ทีมย้ายการ์ดกี่ครั้งลูกค้าก็ไม่เห็นอะไรเปลี่ยน จนกว่าจะมีคนรับผิดชอบกดจริง
 * (ตัดสิน 20 ส.ค. 2569 — "ต้องได้รับการกดจากคนที่มีหน้าที่ก่อนเท่านั้น ไม่มี auto")
 *
 * ═══ กล่อง "ลูกค้าเห็นแบบนี้" ═══
 * เรียก `GET /tasks/:id/client-view` ซึ่งใช้ serializer **ตัวเดียวกับพอร์ทัลจริง**
 * ถ้าเขียนตัวที่สอง วันหนึ่งจะต่างกัน แล้วกล่องนี้จะโกหก
 * ซึ่งอันตรายกว่าไม่มีกล่องนี้เลย เพราะทีมจะเชื่อมันแล้วเผลอเขียนอะไรที่ลูกค้าไม่ควรเห็น
 *
 * ═══ เส้นเวลาของนาฬิกา ═══
 * แสดงทุกช่วงที่เดินและหยุดพร้อมเหตุผล เพราะลูกค้ามีสิทธิ์ถามย้อนหลัง
 * ยอดรวมคำนวณสดจากช่วงเหล่านี้ ไม่มีตัวเลขสะสมเก็บไว้ให้ใครแก้
 */
interface ClockStatus {
  clockId: string;
  state: 'running' | 'paused' | 'resolved';
  targetResolveMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  dueAt: string | null;
  isOverdue: boolean;
  minutesBeforeTriage: number | null;
  segments: { kind: string; at: string; reason: string | null }[];
}

const KIND: Record<string, string> = {
  start: 'ลูกค้ากดส่ง — นาฬิกาเริ่มเดิน',
  resume: 'เดินต่อ',
  pause_hours: 'หยุด — นอกเวลาทำการ',
  pause_customer: 'หยุด — รอลูกค้าตอบ',
  pause_vendor: 'หยุด — รอผู้ให้บริการภายนอก',
  stop: 'ปิดนาฬิกา',
};

/** 5 ขั้นที่ลูกค้าเห็น — ทุกปุ่มต้องมีคนกด */
const STAGES: { key: string; label: string; hint: string }[] = [
  { key: 'received', label: 'รับเรื่องแล้ว', hint: 'รับเป็นเจ้าของด้วยถ้ายังไม่มีใครถือ' },
  { key: 'investigating', label: 'กำลังตรวจสอบ', hint: '' },
  { key: 'fixing', label: 'กำลังแก้ไข', hint: '' },
  { key: 'verifying', label: 'รอตรวจสอบผล', hint: '' },
  { key: 'resolved', label: 'แก้ไขแล้ว', hint: 'PM เท่านั้น · เป็นคำสัญญากับลูกค้า' },
];

interface ClientView {
  code: string;
  title: string;
  stage: string | null;
  stageLabel: string;
  reportedOn: string;
  scopeNote: string | null;
  timeline: { key: string; label: string; date: string | null; note: string | null }[];
}

const PAUSE_REASONS: { kind: string; label: string }[] = [
  { kind: 'pause_customer', label: 'รอลูกค้าตอบ' },
  { kind: 'pause_vendor', label: 'รอผู้ให้บริการภายนอก' },
  { kind: 'pause_hours', label: 'นอกเวลาทำการ' },
];

function hm(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} นาที`;
  return rest === 0 ? `${h} ชม.` : `${h} ชม. ${rest} นาที`;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WarrantyClockPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const taskId = String(p.taskId ?? '');

  const [st, setSt] = useState<ClockStatus | null>(null);
  const [cv, setCv] = useState<ClientView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('pause_customer');
  const [reason, setReason] = useState('');
  const [stageNote, setStageNote] = useState('');

  const load = useCallback(async () => {
    try {
      const [clock, view] = await Promise.all([
        api.get<ClockStatus>(`/t/${tenant}/sla/clocks/${taskId}`),
        api.get<ClientView>(`/t/${tenant}/tasks/${taskId}/client-view`),
      ]);
      setSt(clock);
      setCv(view);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, taskId]);

  async function press(stage: string) {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/tasks/${taskId}/portal-stage`, {
        stage,
        note: stageNote.trim() || undefined,
      });
      setStageNote('');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function pause() {
    setBusy(true);
    setErr(null);
    try {
      setSt(
        await api.post<ClockStatus>(`/t/${tenant}/sla/clocks/${taskId}/pause`, { kind, reason }),
      );
      setReason('');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    setErr(null);
    try {
      setSt(await api.post<ClockStatus>(`/t/${tenant}/sla/clocks/${taskId}/resume`));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title={cv ? `${cv.code} · ${cv.title}` : 'ทิกเก็ตงานประกัน'}
        desc={
          st === null
            ? 'กำลังโหลด…'
            : st.state === 'running'
              ? 'เดินอยู่'
              : st.state === 'paused'
                ? 'หยุดอยู่'
                : 'ปิดแล้ว'
        }
        right={
          <Link href={`/${tenant}/sla`} className="btn btn-2 btn-sm">
            กลับศูนย์ SLA
          </Link>
        }
      />
      {err ? <div className="alert e">{err}</div> : null}

      {st ? (
        <>
          <Card className="mb">
            <div className="card-b">
              <div className="kv">
                <span>เป้าหมาย</span>
                <b className="mn">{hm(st.targetResolveMinutes)}</b>
              </div>
              <div className="kv">
                <span>ใช้ไปแล้ว</span>
                <b className="mn">{hm(st.usedMinutes)}</b>
              </div>
              <div className="kv">
                <span>{st.isOverdue ? 'เกินมา' : 'เหลือ'}</span>
                <b className={`mn ${st.isOverdue ? 'pr pr-critical' : ''}`}>
                  {hm(st.remainingMinutes)}
                </b>
              </div>
              {st.dueAt ? (
                <div className="kv">
                  <span>ครบกำหนด</span>
                  <b className="mn">{fmt(st.dueAt)}</b>
                </div>
              ) : null}
              {st.minutesBeforeTriage !== null ? (
                <div className="alert i" style={{ marginTop: 12 }}>
                  <span>ℹ</span>
                  <div>
                    ก่อนคัดแยกเสร็จใช้ไป <b>{hm(st.minutesBeforeTriage)}</b> —
                    เป็นเวลาที่หมดไปกับการตัดสินใจภายใน ไม่ใช่เวลาที่ลงมือแก้
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="mb">
            <div className="card-h">
              <b>สถานะที่ลูกค้าเห็น</b>
              <div className="r">
                <span className="sub">{cv?.stageLabel ?? '—'}</span>
              </div>
            </div>
            <div className="card-b">
              <p className="hint" style={{ marginBottom: 10 }}>
                ไม่ขยับเองเมื่อย้ายการ์ดบนบอร์ด — ต้องกดที่นี่เท่านั้น ลูกค้าเห็นวันที่ของขั้นที่กด แต่ไม่เห็นเวลาและไม่เห็นตัวเลข
                SLA ใดๆ
              </p>
              <input
                className="inp"
                style={{ marginBottom: 10 }}
                placeholder="หมายเหตุถึงลูกค้า (ไม่บังคับ · บังคับเมื่อถอยขั้น)"
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STAGES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={cv?.stage === s.key ? 'btn btn-pri btn-sm' : 'btn btn-2 btn-sm'}
                    disabled={busy || cv?.stage === s.key}
                    title={s.hint}
                    onClick={() => void press(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {cv ? (
            <Card className="mb">
              <div className="card-h">
                <b>ลูกค้าเห็นแบบนี้</b>
                <div className="r">
                  <span className="sub">ผ่าน serializer ตัวเดียวกับพอร์ทัลจริง</span>
                </div>
              </div>
              <div className="card-b">
                <div className="steps">
                  {cv.timeline.map((s, i) => (
                    <div key={s.key} className={`step${s.date ? ' done' : ''}`}>
                      <span className="dotstep">{s.date ? '✓' : i + 1}</span>
                      <div>
                        <div className="step-l">{s.label}</div>
                        <div className="sub mn" style={{ fontSize: 11.5 }}>
                          {s.date ?? 'ยังไม่ถึงขั้นนี้'}
                        </div>
                        {s.note ? <div className="sub">{s.note}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
                {cv.scopeNote ? (
                  <p className="sub" style={{ marginTop: 10 }}>
                    ผลการตรวจสอบเบื้องต้น: {cv.scopeNote}
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {st.state !== 'resolved' ? (
            <Card className="mb">
              <div className="card-h">
                <b>ควบคุมนาฬิกา</b>
              </div>
              <div className="card-b">
                {st.state === 'running' ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label className="sub" htmlFor="pause-kind">
                      หยุดเพราะอะไร — ลูกค้ามีสิทธิ์ถามย้อนหลัง
                    </label>
                    <select
                      id="pause-kind"
                      className="inp"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      {PAUSE_REASONS.map((r) => (
                        <option key={r.kind} value={r.kind}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="inp"
                      placeholder="รายละเอียด เช่น รอลูกค้าส่งภาพหน้าจอ"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div>
                      <button
                        type="button"
                        className="btn btn-2 btn-sm"
                        disabled={busy || !reason.trim()}
                        onClick={() => void pause()}
                      >
                        หยุดนาฬิกา
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-pri btn-sm"
                    disabled={busy}
                    onClick={() => void resume()}
                  >
                    เดินนาฬิกาต่อ
                  </button>
                )}
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="card-h">
              <b>เส้นเวลา</b>
              <div className="r">
                <span className="sub">{st.segments.length} เหตุการณ์</span>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>เมื่อ</th>
                  <th>เกิดอะไรขึ้น</th>
                  <th>เหตุผล</th>
                </tr>
              </thead>
              <tbody>
                {st.segments.map((sg) => (
                  <tr key={`${sg.kind}-${sg.at}`}>
                    <td className="mn">{fmt(sg.at)}</td>
                    <td>{KIND[sg.kind] ?? sg.kind}</td>
                    <td className="sub">{sg.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : null}
    </>
  );
}
