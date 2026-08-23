'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TaskRow, type TaskRowData } from '@/components/task-row';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 25 · ปฏิทินกำหนดส่ง
 *
 * แสดงเฉพาะการ์ดที่มีวันกำหนดส่ง — การ์ดที่ยังไม่ตั้งวันไม่มีที่อยู่บนปฏิทิน
 * และการไม่แสดงมันไว้ตรงไหนสักที่ดีกว่าเดาวันให้เอง
 */
interface Day {
  date: string;
  tasks: TaskRowData[];
}

function monthRange(offset: number) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    label: `${first.getUTCMonth() + 1}/${first.getUTCFullYear() + 543}`,
  };
}

export default function CalendarPage() {
  const tenant = String(useParams().tenant ?? '');
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<Day[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const r = monthRange(offset);

  useEffect(() => {
    api
      .get<Day[]>(`/t/${tenant}/calendar?from=${r.from}&to=${r.to}`)
      .then(setDays)
      .catch((e) => setErr(errorText(e)));
  }, [tenant, r.from, r.to]);

  const total = (days ?? []).reduce((n, d) => n + d.tasks.length, 0);

  return (
    <>
      <PageHead
        title="ปฏิทินกำหนดส่ง"
        desc={days ? `${total} การ์ดมีกำหนดส่งในเดือนนี้` : 'กำลังโหลด…'}
        right={
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-sm btn-2"
              onClick={() => setOffset(offset - 1)}
            >
              ‹
            </button>
            <b className="mn">{r.label}</b>
            <button
              type="button"
              className="btn btn-sm btn-2"
              onClick={() => setOffset(offset + 1)}
            >
              ›
            </button>
          </span>
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card>
        <div className="card-b">
          {days === null ? (
            <div className="hint">กำลังโหลด…</div>
          ) : days.length === 0 ? (
            <div className="empty">ไม่มีการ์ดที่ครบกำหนดในเดือนนี้</div>
          ) : (
            days.map((d) => (
              <div key={d.date} style={{ marginBottom: 12 }}>
                <div className="lbl mn" style={{ marginBottom: 4 }}>
                  {d.date}
                </div>
                {d.tasks.map((t) => (
                  <TaskRow key={t.id} task={t} tenant={tenant} />
                ))}
              </div>
            ))
          )}
          <div className="hint">การ์ดที่ยังไม่ตั้งวันกำหนดส่งไม่ปรากฏที่นี่ — ไม่เดาวันให้เอง</div>
        </div>
      </Card>
    </>
  );
}
