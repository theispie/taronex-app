'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 16 · ตั้งค่างานหลัก
 *
 * งานหลักไม่มีช่องวันที่โดยตั้งใจ — ช่วงงานคำนวณจากการ์ดลูก
 * ถ้าให้กรอกวันที่เอง วันหนึ่งมันจะไม่ตรงกับการ์ดจริง แล้วไม่มีใครรู้ว่าอันไหนถูก
 *
 * ลบงานหลักแล้ว **การ์ดลูกไม่หาย** กลายเป็นงานนอกแผนแทน
 */
interface Feature {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  startsOn: string | null;
  endsOn: string | null;
}

export default function FeaturesPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [rows, setRows] = useState<Feature[] | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Feature[]>(`/t/${tenant}/projects/${key}/features`));
    } catch (e) {
      setErr(errorText(e));
      setRows([]);
    }
  }, [tenant, key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post(`/t/${tenant}/projects/${key}/features`, { name });
      setName('');
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  async function remove(id: string) {
    setErr(null);
    setMsg(null);
    try {
      const r = await api.del<{ tasksBecameUnplanned: number }>(`/t/${tenant}/features/${id}`);
      setMsg(
        r.tasksBecameUnplanned > 0
          ? `ลบแล้ว · การ์ด ${r.tasksBecameUnplanned} ใบกลายเป็นงานนอกแผน ไม่ได้ถูกลบ`
          : 'ลบแล้ว',
      );
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  return (
    <>
      <PageHead title={`${key} · งานหลัก`} desc="ก้อนงานที่ส่งมอบได้ 1–3 สัปดาห์" />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}
      {msg ? (
        <div className="alert o" style={{ marginBottom: 14 }}>
          <span>✓</span>
          <div>{msg}</div>
        </div>
      ) : null}

      <Card className="mb">
        <div className="card-b">
          {rows === null ? (
            <div className="hint">กำลังโหลด…</div>
          ) : rows.length === 0 ? (
            <div className="empty">ยังไม่มีงานหลัก · การ์ดทุกใบจะนับเป็นงานนอกแผน</div>
          ) : (
            rows.map((f) => (
              <div className="row" key={f.id}>
                <span className="sq" style={{ background: f.color, width: 10, height: 10 }} />
                <span className="row-title">{f.name}</span>
                <span className="sub mn">{f.taskCount} การ์ด</span>
                <span className="sub">
                  {f.startsOn && f.endsOn ? `${f.startsOn} → ${f.endsOn}` : 'ยังไม่มีวันจากการ์ด'}
                </span>
                <button type="button" className="btn btn-sm btn-dn" onClick={() => remove(f.id)}>
                  ลบ
                </button>
              </div>
            ))
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            ไม่มีช่องวันที่ให้กรอก — ช่วงงานคำนวณจากการ์ดลูกเสมอ
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-h">
          <b>เพิ่มงานหลัก</b>
        </div>
        <form className="card-b" onSubmit={add}>
          <div className="fld" style={{ marginBottom: 12 }}>
            <span className="lbl">ชื่องานหลัก</span>
            <input
              className="inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ตะกร้าและชำระเงิน"
              required
            />
          </div>
          <button type="submit" className="btn btn-pri">
            ＋ งานหลักใหม่
          </button>
        </form>
      </Card>
    </>
  );
}
