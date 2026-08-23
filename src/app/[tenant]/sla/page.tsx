'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 33 · ศูนย์งานประกัน / SLA
 *
 * เรียงตามเวลาที่เหลือ ไม่ใช่ตามวันที่แจ้ง — สิ่งที่ต้องตัดสินใจคือ "ทำอะไรก่อน"
 * "เกินมา 3 ชม." ตรงกว่า "ละเมิด SLA" ซึ่งฟังเหมือนกล่าวโทษคนในทีม
 *
 * **เรื่องที่ยังไม่มีใครกดรับขึ้นบนสุดเสมอ** ต่อให้เวลาเหลือเยอะกว่า
 * เพราะนาฬิกาเดินตั้งแต่ลูกค้ากดส่ง แต่ยังไม่มีใครถือการ์ดใบนั้นอยู่
 *
 * กฎข้อ 9 — ตัวเลขที่นี่เป็นราย*เรื่อง* ไม่ใช่ราย*คน* จึงไม่มีคอลัมน์ผู้รับผิดชอบให้เรียง
 */
interface SlaRow {
  taskId: string;
  code: string;
  title: string;
  projectId: string;
  projectName: string;
  clientName: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  warrantyScope: 'pending' | 'covered' | 'billable' | 'not_ours';
  portalStage: string | null;
  state: 'running' | 'paused';
  targetResolveMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  unclaimed: boolean;
}

const SCOPE: Record<SlaRow['warrantyScope'], { label: string; cls: string }> = {
  pending: { label: 'รอคัดแยก', cls: 'st-todo' },
  covered: { label: 'อยู่ในประกัน', cls: 'st-done' },
  billable: { label: 'งานเพิ่ม', cls: 'st-doing' },
  not_ours: { label: 'ไม่เกี่ยวกับเรา', cls: '' },
};

/** 195 → "3 ชม. 15 น." · ไม่แสดงเป็นวัน เพราะวันทำการกับวันปฏิทินไม่เท่ากัน */
function hm(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} น.`;
  return rest === 0 ? `${h} ชม.` : `${h} ชม. ${rest} น.`;
}

export default function SlaPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<SlaRow[] | null>(null);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overview, queue] = await Promise.all([
        api.get<SlaRow[]>(`/t/${tenant}/sla/overview`),
        api.get<{ taskId: string }[]>(`/t/${tenant}/sla/triage`),
      ]);
      setRows(overview);
      setPending(queue.length);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHead
        title="ศูนย์งานประกัน / SLA"
        desc="เรียงตามเวลาที่เหลือ · เรื่องที่ยังไม่มีใครรับขึ้นก่อนเสมอ"
        right={
          <Link href={`/${tenant}/sla/triage`} className="btn btn-2 btn-sm">
            คิวคัดแยก {pending}
          </Link>
        }
      />
      {err ? <div className="alert e">{err}</div> : null}
      <Card>
        {rows === null ? (
          <div className="empty">กำลังโหลด…</div>
        ) : rows.length === 0 ? (
          <div className="empty">ไม่มีเรื่องค้าง</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัส</th>
                <th>เรื่อง</th>
                <th>ลูกค้า</th>
                <th>การคัดแยก</th>
                <th>นาฬิกา</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const sc = SCOPE[t.warrantyScope];
                const over = t.remainingMinutes < 0;
                return (
                  <tr key={t.taskId}>
                    <td>
                      <Link href={`/${tenant}/sla/${t.taskId}`} className="cd mn">
                        {t.code}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {t.title}
                      {t.unclaimed ? (
                        <span className="chip st-todo" style={{ marginLeft: 8 }}>
                          ยังไม่มีใครรับเรื่อง
                        </span>
                      ) : null}
                    </td>
                    <td className="sub">{t.clientName}</td>
                    <td>
                      <span className={`chip ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td>
                      {t.state === 'paused' ? (
                        <span className="sub">หยุดอยู่ · ใช้ไป {hm(t.usedMinutes)}</span>
                      ) : over ? (
                        <span className="pr pr-critical">เกินมา {hm(t.remainingMinutes)}</span>
                      ) : (
                        <span>เหลือ {hm(t.remainingMinutes)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>
          นาฬิกาเดินตั้งแต่วินาทีที่ลูกค้ากดส่ง ไม่รอให้เจ้าหน้าที่กดรับเรื่อง — เวลาที่เรื่องนอนรออยู่คือเวลาที่ลูกค้ารอจริง
          เปิดเรื่องแล้วดูได้ว่าหมดไปกับการคัดแยกเท่าไร
        </div>
      </div>
    </>
  );
}
