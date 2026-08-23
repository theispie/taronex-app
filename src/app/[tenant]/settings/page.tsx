'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SettingsTabs } from '@/components/settings-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 07 · ตั้งค่าที่ทำงาน
 * แยกจากตั้งค่าบัญชีส่วนตัวโดยตั้งใจ — อันนี้เป็นของบริษัท ไม่ใช่ของคน
 * เจ้าของเท่านั้นที่แก้ได้ · คนอื่นเห็นแต่แก้ไม่ได้
 */
interface Workspace {
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone: string;
  yourRole: string;
  usage: { projects: number; seats: number };
}

export default function SettingsPage() {
  const tenant = String(useParams().tenant ?? '');
  const [ws, setWs] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Workspace>(`/t/${tenant}/workspace`)
      .then((d) => {
        setWs(d);
        setName(d.name);
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant]);

  const isOwner = ws?.yourRole === 'owner';

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.patch(`/t/${tenant}/workspace`, { name });
      setMsg('บันทึกแล้ว');
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="ตั้งค่าที่ทำงาน" desc="ข้อมูลของบริษัท ไม่ใช่ของคุณคนเดียว" />
      <SettingsTabs base={`/${tenant}`} />

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

      <form onSubmit={save}>
        <Card className="mb">
          <div className="card-h">
            <b>ข้อมูลที่ทำงาน</b>
            {!isOwner && ws ? (
              <div className="r">
                <span className="chip">เจ้าของเท่านั้นที่แก้ได้</span>
              </div>
            ) : null}
          </div>
          <div className="card-b">
            <div className="fld">
              <span className="lbl">ชื่อที่ทำงาน</span>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isOwner}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">ที่อยู่</span>
              <input className="inp mn" value={`/app/${ws?.slug ?? ''}`} readOnly />
              <div className="hint">รหัสนี้ไม่ใช่สิทธิ์ — ทุกคำขอยังตรวจสมาชิกฝั่งเซิร์ฟเวอร์เสมอ</div>
            </div>
            <div className="fld">
              <span className="lbl">เขตเวลา</span>
              <input className="inp mn" value={ws?.timezone ?? ''} readOnly />
            </div>
            {isOwner ? (
              <button type="submit" className="btn btn-pri" disabled={busy}>
                {busy ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            ) : null}
          </div>
        </Card>
      </form>

      <Card>
        <div className="card-h">
          <b>แผนและโควตา</b>
        </div>
        <div className="card-b">
          <div className="kv">
            <span>แผนปัจจุบัน</span>
            <b>{ws?.plan ?? '—'}</b>
          </div>
          <div className="kv">
            <span>สถานะ</span>
            <b>{ws?.status ?? '—'}</b>
          </div>
          <div className="kv">
            <span>โปรเจกต์ที่เปิดอยู่</span>
            <b className="mn">{ws?.usage.projects ?? 0}</b>
          </div>
          <div className="kv">
            <span>ที่นั่งที่ใช้</span>
            <b className="mn">{ws?.usage.seats ?? 0}</b>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            บัญชีลูกค้าและผู้ติดต่อฟรีทุกแผน ไม่นับโควตาที่นั่ง
          </div>
        </div>
      </Card>
    </>
  );
}
