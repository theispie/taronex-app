'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 39 · ทิกเก็ตงานประกัน — ส่วนนาฬิกา
 *
 * ═══ ส่วนที่ยังไม่มีในหน้านี้ ═══
 * แถบสถานะที่ลูกค้าเห็น (`portal_stage`) และ "ดูอย่างที่ลูกค้าเห็น" (`client-view`)
 * อยู่ใน M11 · จงใจไม่เขียนเวอร์ชันชั่วคราวไว้ก่อน
 * เพราะถ้าเขียน serializer ซ้ำอีกตัว หน้าตัวอย่างจะโกหกว่าลูกค้าเห็นอะไร
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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('pause_customer');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setSt(await api.get<ClockStatus>(`/t/${tenant}/sla/clocks/${taskId}`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, taskId]);

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
        title="นาฬิกา SLA"
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
