'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 38 · คิวคัดแยกเรื่องที่ลูกค้าแจ้ง
 *
 * จุดที่เอเจนซี่เสียเงินมากที่สุดในสัญญา MA — ลูกค้าแจ้ง "บั๊ก" ที่จริงคืองานใหม่
 * แล้วไม่มีใครกล้าปฏิเสธเพราะไม่มีหลักฐาน
 * "ไม่เกี่ยวกับเรา" ตรงกว่า "นอกขอบเขต" และไม่ฟังเหมือนโยนความผิด
 *
 * **นาฬิกาเดินอยู่แล้วตั้งแต่ลูกค้ากดส่ง** (ตัดสิน 20 ส.ค. 2569)
 * ต้นแบบเดิมเขียนว่านาฬิกาเริ่มเดินตอนคัดแยกเสร็จ — เปลี่ยนแล้ว
 * เวลาที่ใช้ตัดสินใจภายในจึงถูกนับด้วย และแสดงแยกให้เห็นว่ากินไปเท่าไร
 *
 * ทุกปุ่มต้องมีคนกด ไม่มีการเดาให้อัตโนมัติ
 */
interface TriageItem {
  taskId: string;
  code: string;
  title: string;
  description: string | null;
  priority: string;
  reportedImpact: string | null;
  portalStage: string | null;
  createdAt: string;
  projectName: string;
  clientName: string;
}

const IMPACT: Record<string, string> = {
  blocked: 'ทำงานต่อไม่ได้',
  degraded: 'ใช้ได้แต่ติดขัด',
  cosmetic: 'ไม่กระทบการใช้งาน',
};

type Scope = 'covered' | 'billable' | 'not_ours';

const CHOICES: { scope: Scope; title: string; desc: string; needsReason: boolean }[] = [
  {
    scope: 'covered',
    title: 'อยู่ในประกัน',
    desc: 'เราทำให้ฟรีตามสัญญา · นาฬิกาเดินต่อ',
    needsReason: false,
  },
  {
    scope: 'billable',
    title: 'งานเพิ่ม ฿',
    desc: 'ไม่ได้อยู่ในขอบเขตเดิม ต้องเสนอราคาก่อน',
    needsReason: true,
  },
  {
    scope: 'not_ours',
    title: 'ไม่เกี่ยวกับเรา',
    desc: 'เกิดจากระบบอื่นหรือผู้ให้บริการภายนอก',
    needsReason: true,
  },
];

function waited(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'วันนี้';
  return `${days} วันก่อน`;
}

export default function TriagePage() {
  const tenant = String(useParams().tenant ?? '');
  const [items, setItems] = useState<TriageItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ taskId: string; scope: Scope } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<TriageItem[]>(`/t/${tenant}/sla/triage`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(taskId: string, scope: Scope, why: string) {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/tasks/${taskId}/triage`, { scope, reason: why });
      setAsking(null);
      setReason('');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const pending = items ?? [];

  return (
    <>
      <PageHead
        title="คิวคัดแยก"
        desc={items === null ? 'กำลังโหลด…' : `${pending.length} เรื่องรอคัดแยก · นาฬิกาเดินอยู่ระหว่างนี้`}
      />
      {err ? <div className="alert e">{err}</div> : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {pending.map((t) => (
          <Card key={t.taskId}>
            <div className="card-h">
              <span className="cd mn">{t.code}</span>
              <b>{t.title}</b>
              <div className="r">
                <span className="sub">
                  {t.clientName} · {t.projectName} · แจ้งเมื่อ {waited(t.createdAt)}
                </span>
              </div>
            </div>
            <div className="card-b">
              {t.description ? (
                <p className="sub" style={{ marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                  {t.description}
                </p>
              ) : null}
              <p className="sub" style={{ marginBottom: 12 }}>
                ลูกค้าเลือกระดับผลกระทบ:{' '}
                <span className="chip">
                  {t.reportedImpact ? (IMPACT[t.reportedImpact] ?? t.reportedImpact) : 'ไม่ได้ระบุ'}
                </span>{' '}
                <span className="hint">(ระดับที่ทีมตั้งจริงอาจต่างจากนี้)</span>
              </p>

              {asking?.taskId === t.taskId ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <label className="sub" htmlFor={`why-${t.taskId}`}>
                    บอกลูกค้าว่าทำไมไม่อยู่ในประกัน — ข้อความนี้จะขึ้นในพอร์ทัล
                  </label>
                  <textarea
                    id={`why-${t.taskId}`}
                    className="in"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-1 btn-sm"
                      disabled={busy || !reason.trim()}
                      onClick={() => void decide(t.taskId, asking.scope, reason)}
                    >
                      ยืนยัน
                    </button>
                    <button
                      type="button"
                      className="btn btn-2 btn-sm"
                      onClick={() => {
                        setAsking(null);
                        setReason('');
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <div className="triage">
                  {CHOICES.map((c) => (
                    <button
                      key={c.scope}
                      type="button"
                      className="btn btn-2 tri"
                      disabled={busy}
                      onClick={() => {
                        if (c.needsReason) {
                          setAsking({ taskId: t.taskId, scope: c.scope });
                          setReason('');
                        } else {
                          void decide(t.taskId, c.scope, '');
                        }
                      }}
                    >
                      <b>{c.title}</b>
                      <span>{c.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
        {items !== null && pending.length === 0 ? (
          <Card>
            <div className="empty">คัดแยกครบแล้ว</div>
          </Card>
        ) : null}
      </div>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>
          นาฬิกาเดินตั้งแต่ลูกค้ากดส่ง เวลาที่ใช้คัดแยกจึงถูกนับด้วย — เปิดเรื่องแล้วดูได้ว่าหมดไปเท่าไร เลือก “งานเพิ่ม” หรือ
          “ไม่เกี่ยวกับเรา” แล้วนาฬิกาจะหยุดทันที
        </div>
      </div>
    </>
  );
}
