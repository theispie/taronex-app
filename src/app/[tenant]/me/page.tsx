'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 10 · โปรไฟล์ของฉันในที่ทำงานนี้
 *
 * ตำแหน่งงานอยู่ที่นี่เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน
 * ส่วนชื่อกับรหัสผ่านอยู่ที่ "ตั้งค่าบัญชี" เพราะเป็นข้อมูลของคน ไม่ใช่ของบริษัท
 */
const TITLES = [
  { key: 'pm', label: 'PM' },
  { key: 'ba', label: 'BA' },
  { key: 'dev', label: 'Dev' },
  { key: 'qa', label: 'QA' },
  { key: 'design', label: 'Design' },
  { key: 'other', label: 'อื่นๆ' },
];

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
}

export default function MyProfilePage() {
  const tenant = String(useParams().tenant ?? '');
  const [me, setMe] = useState<Member | null>(null);
  const [jobTitle, setJobTitle] = useState('other');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ user: { userId: string } }>('/auth/me'),
      api.get<Member[]>(`/t/${tenant}/members`),
    ])
      .then(([auth, list]) => {
        const mine = list.find((m) => m.userId === auth.user.userId) ?? null;
        setMe(mine);
        if (mine) setJobTitle(mine.jobTitle);
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.patch(`/t/${tenant}/me`, { jobTitle });
      setMsg('บันทึกแล้ว');
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="โปรไฟล์ของฉัน" desc="ตำแหน่งงานในที่ทำงานนี้" />

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
            <b>ในที่ทำงานนี้</b>
          </div>
          <div className="card-b">
            <div className="kv">
              <span>ชื่อ</span>
              <b>{me?.name ?? '—'}</b>
            </div>
            <div className="kv">
              <span>อีเมล</span>
              <b className="mn">{me?.email ?? '—'}</b>
            </div>
            <div className="kv">
              <span>บทบาท</span>
              <b>{me?.role ?? '—'}</b>
            </div>
            <div className="fld" style={{ marginTop: 14 }}>
              <span className="lbl">ตำแหน่งงาน</span>
              <select
                className="inp"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              >
                {TITLES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="hint">ใช้แสดงผลและกรองเท่านั้น — ไม่เปลี่ยนสิทธิ์ของคุณแม้แต่นิดเดียว</div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={busy || !me}>
              {busy ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </Card>
      </form>

      <Card>
        <div className="card-h">
          <b>ข้อมูลส่วนตัว</b>
        </div>
        <div className="card-b">
          <p className="sub" style={{ marginBottom: 10 }}>
            ชื่อและรหัสผ่านเป็นของคุณ ไม่ใช่ของที่ทำงานนี้ จึงแก้ที่หน้าตั้งค่าบัญชี แก้ครั้งเดียวมีผลกับทุกที่ทำงานที่คุณอยู่
          </p>
          <Link href="/account" className="btn btn-2">
            ไปหน้าตั้งค่าบัญชี
          </Link>
        </div>
      </Card>
    </>
  );
}
