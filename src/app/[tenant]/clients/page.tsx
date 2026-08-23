'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 28 · รายชื่อลูกค้า
 * พอร์ทัลผูกกับเฟส ไม่ใช่สวิตช์แยก — ลดจำนวนสิ่งที่ต้องจำว่าเปิดหรือยัง
 * คอลัมน์ผู้ติดต่อบอกจำนวนคน ไม่ใช่ชื่อ เพราะรายชื่อยาวเกินกว่าจะใส่ในตาราง
 * "ยังไม่เปิด" ไม่ใช่ "ปิด" เพราะเป็นสถานะปกติของโปรเจกต์ที่ยังทำอยู่
 */
interface ClientRow {
  id: string;
  name: string;
  code: string;
  contacts: number;
  projects: number;
  portalEnabled: boolean;
}

export default function ClientsPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ClientRow[]>(`/t/${tenant}/clients`)
      .then(setRows)
      .catch((e) => {
        setErr(errorText(e));
        setRows([]);
      });
  }, [tenant]);

  return (
    <>
      <PageHead
        title="ลูกค้า"
        desc={rows === null ? 'กำลังโหลด…' : `${rows.length} ราย · บัญชีลูกค้าฟรีทุกแผน ไม่นับโควตา`}
        right={
          <Link href={`/${tenant}/clients/new`} className="btn btn-pri btn-sm">
            ＋ เพิ่มลูกค้า
          </Link>
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card>
        {rows !== null && rows.length === 0 && !err ? (
          <div className="empty">ยังไม่มีลูกค้า · กด “เพิ่มลูกค้า” เพื่อเริ่ม</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ชื่อลูกค้า</th>
                <th>ผู้ติดต่อ</th>
                <th>โปรเจกต์</th>
                <th>พอร์ทัล</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>
                    <Link href={`/${tenant}/clients/${c.id}`}>{c.name}</Link>
                  </td>
                  <td className="mn sub">{c.contacts} คน</td>
                  <td className="mn sub">{c.projects}</td>
                  <td>
                    {c.portalEnabled ? (
                      <span className="chip st-done">เปิดอยู่</span>
                    ) : (
                      <span className="chip">ยังไม่เปิด</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/${tenant}/clients/${c.id}`} className="btn btn-sm btn-gh">
                      จัดการ
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>พอร์ทัลเปิดอัตโนมัติเมื่อโปรเจกต์เข้าเฟสประกัน — ไม่มีสวิตช์แยกให้ลืมเปิด</div>
      </div>
    </>
  );
}
