'use client';

import { useCallback, useEffect, useState } from 'react';

/** รูปร่างคำตอบของ GET /api/v1/meta/health */
interface Health {
  status: string;
  time: string;
  uptimeSeconds: number;
  node: string;
  memory: { rssMb: number; heapUsedMb: number };
  checks: Record<string, string>;
}

const LABEL: Record<string, string> = {
  web: 'เว็บ',
  database: 'ฐานข้อมูล',
  storage: 'ที่เก็บไฟล์',
  queue: 'คิวงาน',
  mail: 'อีเมล',
};

function uptimeText(sec: number): string {
  if (sec < 60) return `${sec} วิ`;
  if (sec < 3600) return `${Math.floor(sec / 60)} นาที`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ชม.`;
  return `${Math.floor(sec / 86400)} วัน`;
}

/**
 * ยิงจริงไปที่ /api/v1/meta/health ทุก 20 วินาที
 * เป็นตัวพิสูจน์ว่าชั้น API ตอบได้จริง ไม่ใช่แค่หน้าจอที่วาดไว้
 */
export function HealthProbe() {
  const [data, setData] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  const probe = useCallback(async () => {
    const t0 = performance.now();
    try {
      const res = await fetch('/app/api/v1/meta/health', { cache: 'no-store' });
      const body: { data?: Health } = await res.json();
      if (!res.ok || !body.data) throw new Error(`HTTP ${res.status}`);
      setData(body.data);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'เรียกไม่สำเร็จ');
    } finally {
      setMs(Math.round(performance.now() - t0));
    }
  }, []);

  useEffect(() => {
    void probe();
    const id = setInterval(() => void probe(), 20000);
    return () => clearInterval(id);
  }, [probe]);

  if (err) {
    return (
      <div className="alert d">
        <span>✕</span>
        <div>
          เรียก <span className="mn">GET /api/v1/meta/health</span> ไม่สำเร็จ — {err}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="hint">กำลังเรียก /api/v1/meta/health …</div>;
  }

  return (
    <>
      <div className="istat">
        <div className="c">
          <div className="n" style={{ color: 'var(--ok)' }}>
            {ms ?? '—'}
            <span style={{ fontSize: 13, fontWeight: 400 }}> ms</span>
          </div>
          <div className="l">เวลาตอบของ /meta/health</div>
        </div>
        <div className="c">
          <div className="n">
            {data.memory.rssMb}
            <span style={{ fontSize: 13, fontWeight: 400 }}> MB</span>
          </div>
          <div className="l">หน่วยความจำที่เว็บใช้</div>
        </div>
        <div className="c">
          <div className="n">{uptimeText(data.uptimeSeconds)}</div>
          <div className="l">รันมาแล้ว</div>
        </div>
        <div className="c">
          <div className="n mn" style={{ fontSize: 17 }}>
            {data.node}
          </div>
          <div className="l">Node</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {Object.entries(data.checks).map(([k, v]) => (
          <span key={k} className={`chip ${v === 'ok' ? 'st-done' : 'st-todo'}`}>
            <i className="d" />
            {LABEL[k] ?? k} · {v}
          </span>
        ))}
      </div>
    </>
  );
}
