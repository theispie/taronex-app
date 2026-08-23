'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 18 · มุมมองตาราง
 *
 * "ถือมา N วัน" ขึ้นเฉพาะเมื่อเกิน 3 วัน — ถ้าขึ้นทุกใบตาจะชิน แล้วเลิกเห็น
 * สีของคอลัมน์คำนวณจากตำแหน่ง ไม่ได้เก็บไว้ (กฎข้อ 8)
 */
interface Row {
  id: string;
  code: string;
  title: string;
  columnName: string;
  columnIndex: number;
  isClosed: boolean;
  priority: string;
  assigneeName: string | null;
  featureName: string | null;
  dueDate: string | null;
  heldDays: number;
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'ต่ำ',
  medium: 'ปานกลาง',
  high: 'สูง',
  critical: 'ด่วนมาก',
};

/** โทนสีจากตำแหน่ง — ตัวสุดท้ายเสร็จ · รองสุดท้ายคือขั้นตรวจ · แรกคือรอเริ่ม */
function tone(index: number, total: number): string {
  if (index === 0) return 'st-todo';
  if (index === total - 1) return 'st-done';
  if (index === total - 2 && total >= 3) return 'st-review';
  return 'st-doing';
}

export default function TaskListPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [columns, setColumns] = useState(4);
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Row[]>(`/t/${tenant}/projects/${key}/tasks`),
      api.get<{ board: unknown[] }>(`/t/${tenant}/projects/${key}`),
    ])
      .then(([list, proj]) => {
        setRows(list);
        setColumns(proj.board.length);
      })
      .catch((e) => {
        setErr(errorText(e));
        setRows([]);
      });
  }, [tenant, key]);

  const shown = (rows ?? []).filter(
    (r) =>
      !filter ||
      r.title.toLowerCase().includes(filter.toLowerCase()) ||
      r.code.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <>
      <PageHead
        title={`${key} · ตาราง`}
        desc={rows === null ? 'กำลังโหลด…' : `${rows.length} การ์ด`}
        right={
          <Link href={`/${tenant}/projects/${key}/tickets/new`} className="btn btn-pri btn-sm">
            ＋ การ์ดใหม่
          </Link>
        }
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <div className="ifilter" style={{ marginBottom: 12 }}>
        <input
          className="inp"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นชื่อการ์ดหรือรหัส"
        />
        <span className="sub">แสดง {shown.length} ใบ</span>
      </div>

      <Card>
        {rows !== null && shown.length === 0 ? (
          <div className="empty">
            {rows.length === 0 ? 'ยังไม่มีการ์ด · กด “การ์ดใหม่” เพื่อเริ่ม' : 'ไม่พบการ์ดที่ตรงกับที่ค้น'}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อ</th>
                <th>คอลัมน์</th>
                <th>งานหลัก</th>
                <th>ผู้รับผิดชอบ</th>
                <th>ความเร่งด่วน</th>
                <th>กำหนดส่ง</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="mn">
                    <Link href={`/${tenant}/tickets/${r.code}`}>{r.code}</Link>
                  </td>
                  <td>
                    {r.title}
                    {/* ขึ้นเฉพาะเกิน 3 วัน ไม่งั้นตาจะชินแล้วเลิกเห็น */}
                    {r.heldDays > 3 && !r.isClosed ? (
                      <span className="tag hold"> ถือมา {r.heldDays} ว.</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`chip ${tone(r.columnIndex, columns)}`}>{r.columnName}</span>
                  </td>
                  <td className="sub">{r.featureName ?? 'งานนอกแผน'}</td>
                  <td className="sub">{r.assigneeName ?? '—'}</td>
                  <td className="sub">{PRIORITY_LABEL[r.priority] ?? r.priority}</td>
                  <td className="sub mn">{r.dueDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
