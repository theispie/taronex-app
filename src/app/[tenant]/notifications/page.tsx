'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 35 · ศูนย์แจ้งเตือน
 *
 * ส่งอีเมลจริงแค่สามชนิด — มอบหมาย · ตีกลับ · พูดถึงคุณ
 * ที่เหลือขึ้นในระบบอย่างเดียว เพราะอีเมลที่เยอะเกินจะถูกตั้งกฎให้เข้าโฟลเดอร์ทันที
 * แล้วอันที่สำคัญจริงก็จะไม่ถูกอ่านไปด้วย
 */
interface Notification {
  id: string;
  kind: string;
  taskId: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  actorName: string | null;
}

const KIND: Record<string, { label: string; cls: string }> = {
  assigned: { label: 'มอบหมาย', cls: 'st-todo' },
  transferred: { label: 'โอนงาน', cls: 'st-todo' },
  rejected: { label: 'ตีกลับ', cls: 'st-doing' },
  mentioned: { label: 'พูดถึงคุณ', cls: 'st-review' },
  sla_warning: { label: 'ใกล้ครบกำหนด', cls: 'st-blocked' },
  client_reported: { label: 'ลูกค้าแจ้ง', cls: 'st-done' },
};

export default function NotificationsPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<Notification[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Notification[]>(`/t/${tenant}/notifications`));
    } catch (e) {
      setErr(errorText(e));
      setRows([]);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAll() {
    try {
      await api.post(`/t/${tenant}/notifications/read`, { all: true });
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  const unread = (rows ?? []).filter((n) => !n.readAt).length;

  return (
    <>
      <PageHead
        title="การแจ้งเตือน"
        desc={rows ? `${unread} รายการที่ยังไม่ได้อ่าน` : 'กำลังโหลด…'}
        right={
          unread > 0 ? (
            <button type="button" className="btn btn-2 btn-sm" onClick={markAll}>
              ทำเครื่องหมายว่าอ่านทั้งหมด
            </button>
          ) : undefined
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
          {rows === null ? (
            <div className="hint">กำลังโหลด…</div>
          ) : rows.length === 0 ? (
            <div className="empty">ยังไม่มีการแจ้งเตือน</div>
          ) : (
            rows.map((n) => {
              const k = KIND[n.kind] ?? { label: n.kind, cls: '' };
              const title = typeof n.payload.title === 'string' ? n.payload.title : '';
              return (
                <div className="row" key={n.id} style={n.readAt ? { opacity: 0.55 } : undefined}>
                  <span className={`chip ${k.cls}`}>{k.label}</span>
                  <span className="row-title">{title || k.label}</span>
                  {n.actorName ? <span className="sub">{n.actorName}</span> : null}
                  <span className="sub mn" style={{ fontSize: 11 }}>
                    {new Date(n.createdAt).toLocaleString('th-TH')}
                  </span>
                  {n.taskId ? (
                    <Link href={`/${tenant}/tickets/`} className="btn btn-sm btn-gh">
                      เปิด
                    </Link>
                  ) : null}
                </div>
              );
            })
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            ส่งอีเมลจริงแค่สามชนิด — มอบหมาย · ตีกลับ · พูดถึงคุณ ที่เหลือขึ้นในระบบอย่างเดียว
          </div>
        </div>
      </Card>
    </>
  );
}
