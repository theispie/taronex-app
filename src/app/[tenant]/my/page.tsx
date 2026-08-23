'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { TaskRow, type TaskRowData } from '@/components/task-row';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 24 · งานที่ได้รับ
 *
 * จัดกลุ่มจาก "อาการ" ไม่ใช่จากค่าความเร่งด่วนที่ตั้งไว้
 * การ์ดที่ตั้ง critical แต่ยังไม่ถึงกำหนด ไม่ได้เร่งกว่าการ์ดที่เลยกำหนดไปแล้ว
 *
 * ปุ่ม ETA ตอบคำถาม "จะเสร็จเมื่อไร" ซึ่งแยกจากกำหนดส่งโดยตั้งใจ
 * กำหนดส่งคือสัญญากับลูกค้า · ETA คือความเห็นล่าสุดของคนทำ
 */
interface MyTasks {
  late: TaskRowData[];
  dueToday: TaskRowData[];
  stale: TaskRowData[];
  rest: TaskRowData[];
  needEta: TaskRowData[];
  total: number;
}

const ETA = [
  { key: 'today', label: 'วันนี้' },
  { key: 'tomorrow', label: 'พรุ่งนี้' },
  { key: 'this_week', label: 'สัปดาห์นี้' },
  { key: 'unknown', label: 'ยังบอกไม่ได้' },
];

export default function MyTasksPage() {
  const tenant = String(useParams().tenant ?? '');
  const [data, setData] = useState<MyTasks | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<MyTasks>(`/t/${tenant}/me/tasks`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setEta(taskId: string, eta: string) {
    try {
      await api.patch(`/t/${tenant}/tasks/${taskId}/eta`, { eta });
      setAsking(null);
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  const groups: { key: keyof MyTasks; title: string; hint?: string }[] = [
    { key: 'late', title: 'เลยกำหนดแล้ว' },
    { key: 'dueToday', title: 'ครบกำหนดวันนี้' },
    { key: 'stale', title: 'ไม่มีความเคลื่อนไหว', hint: 'ถืออยู่เกิน 5 วันแล้วยังไม่ขยับ' },
    { key: 'rest', title: 'ที่เหลือ' },
  ];

  return (
    <>
      <PageHead title="งานที่ได้รับ" desc={data ? `${data.total} ใบที่ยังไม่ปิด` : 'กำลังโหลด…'} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {data && data.needEta.length > 0 ? (
        <Card className="mb">
          <div className="card-h">
            <b>รอคุณตอบว่าจะเสร็จเมื่อไร</b>
            <div className="r">
              <span className="chip st-doing">{data.needEta.length} ใบ</span>
            </div>
          </div>
          <div className="card-b">
            {data.needEta.map((t) => (
              <div key={t.id}>
                <div className="row">
                  <span className="mn" style={{ minWidth: 76 }}>
                    {t.code}
                  </span>
                  <span className="row-title">{t.title}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-2"
                    onClick={() => setAsking(asking === t.id ? null : t.id)}
                  >
                    จะเสร็จเมื่อไร
                  </button>
                </div>
                {asking === t.id ? (
                  <div style={{ display: 'flex', gap: 6, padding: '0 0 10px 76px' }}>
                    {ETA.map((e) => (
                      <button
                        key={e.key}
                        type="button"
                        className="btn btn-sm btn-2"
                        onClick={() => setEta(t.id, e.key)}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div className="hint" style={{ marginTop: 8 }}>
              คำตอบนี้แยกจากกำหนดส่ง — กำหนดส่งคือสัญญากับลูกค้า อันนี้คือความเห็นของคุณ
            </div>
          </div>
        </Card>
      ) : null}

      {data
        ? groups.map((g) => {
            const rows = data[g.key] as TaskRowData[];
            if (rows.length === 0) return null;
            return (
              <Card className="mb" key={g.key}>
                <div className="card-h">
                  <b>{g.title}</b>
                  <div className="r">
                    <span className="chip">{rows.length}</span>
                  </div>
                </div>
                <div className="card-b">
                  {rows.map((t) => (
                    <TaskRow key={t.id} task={t} tenant={tenant} showAssignee={false} />
                  ))}
                  {g.hint ? (
                    <div className="hint" style={{ marginTop: 8 }}>
                      {g.hint}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        : null}

      {data && data.total === 0 ? <div className="empty">ยังไม่มีการ์ดที่ถืออยู่</div> : null}
    </>
  );
}
