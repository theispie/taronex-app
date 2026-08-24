'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 32 · พอร์ทัล — ติดตามเรื่อง
 *
 * ไม่มีกล่องสนทนา — ลูกค้าดูสถานะได้อย่างเดียว การคุยกันยังใช้โทรศัพท์หรืออีเมลตามเดิม
 * แสดงเฉพาะวันที่ ไม่มีเวลา และ**ไม่มีตัวเลข SLA ใดๆ** เพื่อไม่ให้กลายเป็นเครื่องมือจับผิด
 *
 * ═══ ไทม์ไลน์ 5 ขั้น ทุกขั้นมีคนกด ═══
 * ตัดสิน 20 ส.ค. 2569 — **ไม่แปลงจากคอลัมน์บนบอร์ด**
 * ทีมย้ายการ์ดกี่ครั้งลูกค้าก็ไม่เห็นอะไรเปลี่ยน จนกว่าจะมีเจ้าหน้าที่กดจริง
 * ขั้นที่ยังไม่ถึงขึ้นว่า "ยังไม่ถึงขั้นนี้" ไม่ใช่เดาวันให้
 */
interface Detail {
  code: string;
  title: string;
  description: string | null;
  stage: string | null;
  stageLabel: string;
  isResolved: boolean;
  reportedOn: string;
  scopeNote: string | null;
  timeline: { key: string; label: string; date: string | null; note: string | null }[];
}

function thaiDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PortalIssue() {
  const p = useParams();
  const slug = String(p.slug ?? '');
  const code = String(p.code ?? '');
  const router = useRouter();

  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get<Detail>(`/portal/${slug}/issues/${code}`));
    } catch (e) {
      if (e instanceof ApiCallError && e.code === 'E_UNAUTHENTICATED') {
        router.replace(`/portal/${slug}/login`);
        return;
      }
      setErr(errorText(e));
    }
  }, [slug, code, router]);

  useEffect(() => {
    void load();
  }, [load]);

  // ขั้นที่ถึงแล้ว = มีวันที่ · ขั้นปัจจุบัน = ขั้นสุดท้ายที่มีวันที่
  const lastDone = d ? d.timeline.map((t) => Boolean(t.date)).lastIndexOf(true) : -1;

  return (
    <>
      <p style={{ marginBottom: 12 }}>
        <Link href={`/portal/${slug}`} className="auth-link">
          ← กลับไปรายการ
        </Link>
      </p>

      {err ? <div className="alert e">{err}</div> : null}
      {!d && !err ? <div className="pw-card">กำลังโหลด…</div> : null}

      {d ? (
        <>
          <div className="pw-head">
            <div>
              <span className="mn sub">{d.code}</span>
              <h1>{d.title}</h1>
              <p className="sub">แจ้งเมื่อ {thaiDate(d.reportedOn)}</p>
            </div>
          </div>

          {d.stage === null ? (
            <div className="alert i" style={{ marginBottom: 12 }}>
              <span>ℹ</span>
              <div>{d.stageLabel}</div>
            </div>
          ) : null}

          <div className="pw-card mb">
            <div className="card-b">
              <div className="steps">
                {d.timeline.map((s, i) => {
                  const done = Boolean(s.date);
                  const cur = i === lastDone;
                  return (
                    <div key={s.key} className={`step${done ? ' done' : ''}${cur ? ' cur' : ''}`}>
                      <span className="dotstep">{done ? '✓' : i + 1}</span>
                      <div>
                        <div className="step-l">{s.label}</div>
                        <div className="sub mn" style={{ fontSize: 11.5 }}>
                          {thaiDate(s.date) || 'ยังไม่ถึงขั้นนี้'}
                        </div>
                        {s.note ? <div className="sub">{s.note}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {d.scopeNote ? (
            <div className="pw-card mb">
              <div className="card-b">
                <b style={{ fontSize: 13.5 }}>ผลการตรวจสอบเบื้องต้น</b>
                <p className="sub" style={{ marginTop: 8 }}>
                  {d.scopeNote}
                </p>
              </div>
            </div>
          ) : null}

          <div className="pw-card">
            <div className="card-b">
              <b style={{ fontSize: 13.5 }}>รายละเอียดที่แจ้งไว้</b>
              <p className="sub" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                {d.description || '— ไม่ได้กรอกรายละเอียดเพิ่มเติม —'}
              </p>
              <p className="hint" style={{ marginTop: 14 }}>
                มีข้อมูลเพิ่มเติม? ติดต่อทีมงานได้ตามช่องทางเดิม หรือตอบกลับอีเมลแจ้งเตือนได้เลย
              </p>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
