'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 11 · รายการโปรเจกต์
 * ตัวเลขสามตัวคือ "สุขภาพโปรเจกต์" สำหรับงานเหมา —
 * ขอบเขตบานปลายวัดจากจำนวนการ์ด ไม่ใช่ชั่วโมง
 *
 * ต่อกับ GET /projects แล้ว · ตัวเลขสุขภาพมาจาก GET /projects/{id}/health
 */
interface Project {
  id: string;
  key: string;
  name: string;
  clientName: string;
  taskCount: number;
  phase: { name: string; kind: string } | null;
  isArchived: boolean;
}
interface Health {
  addedAfterBaseline: number | null;
  bounceCount: number;
}

export default function ProjectsPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<Project[] | null>(null);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Project[]>(`/t/${tenant}/projects`)
      .then(async (list) => {
        setRows(list);
        // ดึงตัวเลขสุขภาพขนานกัน หน้าไม่ต้องรอทีละใบ
        const pairs = await Promise.all(
          list.map(async (p) => {
            try {
              return [p.id, await api.get<Health>(`/t/${tenant}/projects/${p.id}/health`)] as const;
            } catch {
              return null;
            }
          }),
        );
        setHealth(Object.fromEntries(pairs.filter((x) => x !== null)));
      })
      .catch((e) => {
        setErr(errorText(e));
        setRows([]);
      });
  }, [tenant]);

  return (
    <>
      <PageHead
        title="โปรเจกต์"
        desc={rows === null ? 'กำลังโหลด…' : `${rows.length} โปรเจกต์ที่เปิดอยู่ · ปิดแล้วไม่นับโควตา`}
        right={
          <Link href={`/${tenant}/projects/new`} className="btn btn-pri">
            ＋ โปรเจกต์ใหม่
          </Link>
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {rows === null ? (
        <div className="hint">กำลังโหลด…</div>
      ) : rows.length === 0 && !err ? (
        <div className="empty">ยังไม่มีโปรเจกต์ · กด “โปรเจกต์ใหม่” เพื่อเริ่ม</div>
      ) : (
        <div className="grid3">
          {rows.map((p) => {
            const h = health[p.id];
            const added = h?.addedAfterBaseline ?? 0;
            const risk = added > 6 ? 'danger' : added > 2 ? 'warn' : 'ok';
            return (
              <Link key={p.id} href={`/${tenant}/projects/${p.key}`} className="card pcard">
                <div className="card-b">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="cd mn">{p.key}</span>
                    <b style={{ fontSize: 13.5 }}>{p.name}</b>
                    <span className={`dot dot-${risk}`} style={{ marginLeft: 'auto' }} />
                  </div>
                  <div className="sub" style={{ marginTop: 2 }}>
                    {p.clientName}
                  </div>
                  <div style={{ margin: '10px 0' }}>
                    <span className={`chip ${p.phase?.kind === 'warranty' ? 'st-done' : ''}`}>
                      เฟส: {p.phase?.name ?? 'ยังไม่ได้ตั้ง'}
                    </span>
                  </div>
                  <div className="hstat">
                    <div>
                      <b>{p.taskCount}</b>
                      <span>การ์ดทั้งหมด</span>
                    </div>
                    <div>
                      <b className={added > 2 ? 'txt-warn' : ''}>
                        {h?.addedAfterBaseline === null ? '—' : `+${added}`}
                      </b>
                      <span>การ์ดที่เพิ่ม</span>
                    </div>
                    <div>
                      <b>{h?.bounceCount ?? 0}</b>
                      <span>รอบตีกลับ</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="alert i" style={{ marginTop: 16 }}>
        <span>ℹ</span>
        <div>โปรเจกต์ที่ปิดแล้วไม่นับโควตา และข้อมูลยังอยู่ครบ</div>
      </div>
    </>
  );
}
