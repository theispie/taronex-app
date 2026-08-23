'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TaskRow, type TaskRowData } from '@/components/task-row';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 23 · หน้าแรก
 *
 * สามบล็อกเรียงตามความเร่ง — รอคุณตัดสินใจ · ต้องรีบ · โปรเจกต์ที่ดูแล
 * "รอคุณตัดสินใจ" คือการ์ดที่อยู่คอลัมน์รองสุดท้ายในโปรเจกต์ที่คุณเป็น PM
 * เพราะคอลัมน์สุดท้ายคือปิดงาน และ PM เป็นคนเดียวที่ย้ายมาได้
 */
interface Home {
  waitingOnYou: TaskRowData[];
  urgent: TaskRowData[];
  stale: TaskRowData[];
  projects: { id: string; key: string; name: string; dueOn: string }[];
  holding: number;
}

export default function HomePage() {
  const tenant = String(useParams().tenant ?? '');
  const [data, setData] = useState<Home | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Home>(`/t/${tenant}/home`)
      .then(setData)
      .catch((e) => setErr(errorText(e)));
  }, [tenant]);

  return (
    <>
      <PageHead title="หน้าแรก" desc={data ? `คุณถืออยู่ ${data.holding} ใบ` : 'กำลังโหลด…'} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {data ? (
        <>
          <Card className="mb">
            <div className="card-h">
              <b>รอคุณตัดสินใจ</b>
              <div className="r">
                <span className={`chip ${data.waitingOnYou.length > 0 ? 'st-review' : ''}`}>
                  {data.waitingOnYou.length}
                </span>
              </div>
            </div>
            <div className="card-b">
              {data.waitingOnYou.length === 0 ? (
                <div className="empty">ไม่มีอะไรรอคุณอยู่</div>
              ) : (
                data.waitingOnYou.map((t) => <TaskRow key={t.id} task={t} tenant={tenant} />)
              )}
              <div className="hint" style={{ marginTop: 8 }}>
                คุณเป็นคนเดียวที่ปิดการ์ดในโปรเจกต์ที่คุณเป็น PM ได้
              </div>
            </div>
          </Card>

          <Card className="mb">
            <div className="card-h">
              <b>ต้องรีบ</b>
              <div className="r">
                <span className={`chip ${data.urgent.length > 0 ? 'st-blocked' : ''}`}>
                  {data.urgent.length}
                </span>
              </div>
            </div>
            <div className="card-b">
              {data.urgent.length === 0 ? (
                <div className="empty">ยังไม่มีอะไรเลยกำหนด</div>
              ) : (
                data.urgent.map((t) => (
                  <TaskRow key={t.id} task={t} tenant={tenant} showAssignee={false} />
                ))
              )}
            </div>
          </Card>

          {data.stale.length > 0 ? (
            <Card className="mb">
              <div className="card-h">
                <b>ไม่มีความเคลื่อนไหว</b>
              </div>
              <div className="card-b">
                {data.stale.map((t) => (
                  <TaskRow key={t.id} task={t} tenant={tenant} showAssignee={false} />
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="card-h">
              <b>โปรเจกต์ที่คุณดูแล</b>
            </div>
            <div className="card-b">
              {data.projects.length === 0 ? (
                <div className="empty">คุณยังไม่ได้เป็น PM ของโปรเจกต์ไหน</div>
              ) : (
                data.projects.map((p) => (
                  <div className="row" key={p.id}>
                    <Link
                      href={`/${tenant}/projects/${p.key}`}
                      className="mn"
                      style={{ minWidth: 60 }}
                    >
                      {p.key}
                    </Link>
                    <span className="row-title">{p.name}</span>
                    <span className="sub mn">ส่ง {p.dueOn}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      ) : !err ? (
        <div className="hint">กำลังโหลด…</div>
      ) : null}
    </>
  );
}
