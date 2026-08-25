'use client';

import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
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
      /**
       * เมนูข้างกับแถบบนวาดจาก layout ที่เป็น **server component**
       * แก้ชื่อผ่าน API แล้วหน้าจอฝั่งนี้เปลี่ยน แต่เปลือกยังเป็นชื่อเดิม
       * จนกว่าจะโหลดหน้าใหม่ — `router.refresh()` สั่งให้ Next วาดเปลือกใหม่
       * โดยไม่ต้องรีโหลดทั้งหน้า
       */
      router.refresh();
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
            {/*
              ที่อยู่ไม่ใช่ช่องกรอก — ทำเป็นช่องเมื่อไหร่คนจะนึกว่าแก้ได้
              และมันแก้ไม่ได้จริงๆ ด้วยเหตุผลสองข้อ
                1. รหัสนี้อยู่ในลิงก์ที่คนบุ๊กมาร์กและส่งต่อกันแล้ว เปลี่ยนเมื่อไหร่ลิงก์เก่าตายหมด
                2. ตั้งใจให้สุ่ม ไม่ให้เดาได้จากชื่อบริษัท — ถ้าเอาชื่อมาต่อเลข
                   คนนอกจะไล่เดาที่อยู่ของบริษัทที่รู้จักได้ (ดู src/lib/tenant-code.ts)
            */}
            <div className="fld">
              <span className="lbl">ที่อยู่ของที่ทำงานนี้</span>
              <div className="kv" style={{ alignItems: 'center' }}>
                <span className="mn" style={{ fontSize: 13.5 }}>
                  /app/{ws?.slug ?? ''}
                </span>
                <button
                  type="button"
                  className="btn btn-2 btn-sm"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(`${window.location.origin}/app/${ws?.slug ?? ''}`)
                      .then(() => setMsg('คัดลอกลิงก์แล้ว'));
                  }}
                >
                  คัดลอกลิงก์
                </button>
              </div>
              <div className="hint">
                เปลี่ยนไม่ได้ — ลิงก์นี้ถูกบุ๊กมาร์กและส่งต่อกันไปแล้ว เปลี่ยนเมื่อไหร่ของเก่าตายหมด
                <br />
                รหัสสุ่มโดยตั้งใจ ไม่ได้มาจากชื่อบริษัท เพื่อไม่ให้คนนอกไล่เดาได้ · และ<b>รหัสนี้ไม่ใช่สิทธิ์</b>{' '}
                ทุกคำขอยังตรวจสมาชิกฝั่งเซิร์ฟเวอร์เสมอ
              </div>
            </div>
            <div className="fld">
              <span className="lbl">เขตเวลา</span>
              <div className="kv">
                <span className="mn" style={{ fontSize: 13.5 }}>
                  {ws?.timezone ?? ''}
                </span>
              </div>
              <div className="hint">
                ใช้คำนวณนาฬิกา SLA และกำหนดส่ง · เปลี่ยนเขตเวลายังทำไม่ได้ในเวอร์ชันนี้
              </div>
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
