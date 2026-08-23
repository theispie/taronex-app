'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 15 · ตั้งค่าเฟส
 *
 * เฟสคือวงจรชีวิตของโปรเจกต์ มีทีละหนึ่งค่า — คนละเรื่องกับคอลัมน์ของการ์ด
 * เฟสชนิด "ประกัน" เป็นสวิตช์ที่เปิดพอร์ทัลลูกค้าและ SLA
 * ไม่มีสวิตช์แยกให้ลืมเปิด และตั้ง portal_enabled เองตรงๆ ไม่ได้
 */
interface Phase {
  id: string;
  name: string;
  kind: 'normal' | 'delivery' | 'warranty';
  position: number;
  startedAt: string | null;
  endedAt: string | null;
}

const KIND_LABEL: Record<string, string> = {
  normal: 'ปกติ',
  delivery: 'ส่งมอบ',
  warranty: 'ประกัน',
};

export default function PhasesPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [rows, setRows] = useState<Phase[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Phase['kind']>('normal');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, proj] = await Promise.all([
        api.get<Phase[]>(`/t/${tenant}/projects/${key}/phases`),
        api.get<{ currentPhaseId: string | null }>(`/t/${tenant}/projects/${key}`),
      ]);
      setRows(list);
      setCurrent(proj.currentPhaseId);
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
      await api.post(`/t/${tenant}/projects/${key}/phases`, { name, kind });
      setName('');
      setKind('normal');
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  async function enter(phaseId: string) {
    setErr(null);
    try {
      await api.post(`/t/${tenant}/projects/${key}/phases/${phaseId}/enter`);
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  return (
    <>
      <PageHead title={`${key} · เฟส`} desc="วงจรชีวิตของโปรเจกต์ มีทีละหนึ่งค่า" />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card className="mb">
        <div className="card-b">
          {rows === null ? (
            <div className="hint">กำลังโหลด…</div>
          ) : rows.length === 0 ? (
            <div className="empty">ยังไม่มีเฟส</div>
          ) : (
            rows.map((ph) => (
              <div className="row" key={ph.id}>
                <span className="row-title">{ph.name}</span>
                <span className={`chip ${ph.kind === 'warranty' ? 'st-done' : ''}`}>
                  {KIND_LABEL[ph.kind]}
                </span>
                {current === ph.id ? (
                  <span className="chip st-review">อยู่เฟสนี้</span>
                ) : (
                  <button type="button" className="btn btn-sm btn-2" onClick={() => enter(ph.id)}>
                    ย้ายมาเฟสนี้
                  </button>
                )}
              </div>
            ))
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            เฟสประกันเปิดพอร์ทัลลูกค้าให้เอง — ไม่มีสวิตช์แยกให้ลืมเปิด
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-h">
          <b>เพิ่มเฟส</b>
        </div>
        <form className="card-b" onSubmit={add}>
          <div className="fld">
            <span className="lbl">ชื่อเฟส</span>
            <input
              className="inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="พัฒนา"
              required
            />
          </div>
          <div className="fld" style={{ marginBottom: 12 }}>
            <span className="lbl">ชนิด</span>
            <select
              className="inp"
              value={kind}
              onChange={(e) => setKind(e.target.value as Phase['kind'])}
            >
              <option value="normal">ปกติ</option>
              <option value="delivery">ส่งมอบ</option>
              <option value="warranty">ประกัน — เปิดพอร์ทัลลูกค้า</option>
            </select>
          </div>
          <button type="submit" className="btn btn-pri">
            ＋ เพิ่มเฟส
          </button>
        </form>
      </Card>
    </>
  );
}
