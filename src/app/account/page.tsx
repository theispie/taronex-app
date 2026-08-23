'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 43 · ตั้งค่าบัญชีส่วนตัว
 *
 * แยกจากตั้งค่าที่ทำงานโดยตั้งใจ — ชื่อกับรหัสผ่านเป็นของคน ไม่ใช่ของบริษัท
 * ตำแหน่งงานไม่ได้อยู่ที่นี่ เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน
 * (อยู่ที่หน้าโปรไฟล์ในแต่ละที่ทำงานแทน)
 */
interface Me {
  user: { userId: string; email: string; name: string };
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Me>('/auth/me')
      .then((d) => {
        setMe(d.user);
        setName(d.user.name);
      })
      .catch((e) => setErr(errorText(e)));
  }, []);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.patch('/account', { name });
      setMsg('บันทึกชื่อแล้ว');
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.patch('/account', { currentPassword, password });
      // เปลี่ยนรหัสแล้วเซสชันตายหมดรวมเครื่องนี้ ต้องเข้าใหม่
      router.push('/login');
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ maxWidth: 520 }}>
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 4 }}>
          ตั้งค่าบัญชี
        </h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          ข้อมูลของคุณ ไม่ใช่ของที่ทำงานใดที่ทำงานหนึ่ง
        </p>

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

        <form className="card" onSubmit={saveName} style={{ marginBottom: 16 }}>
          <div className="card-h">
            <b>ข้อมูลส่วนตัว</b>
          </div>
          <div className="card-b">
            <div className="fld">
              <span className="lbl">ชื่อ</span>
              <input
                className="inp"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">อีเมล</span>
              <input className="inp mn" value={me?.email ?? ''} readOnly />
              <div className="hint">เปลี่ยนอีเมลยังทำไม่ได้ในเวอร์ชันนี้</div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={busy || !me}>
              บันทึก
            </button>
          </div>
        </form>

        <form className="card" onSubmit={changePassword}>
          <div className="card-h">
            <b>เปลี่ยนรหัสผ่าน</b>
          </div>
          <div className="card-b">
            <div className="alert i" style={{ marginBottom: 12 }}>
              <span>ℹ</span>
              <div>เปลี่ยนแล้วทุกเครื่องที่ค้างอยู่จะถูกให้ออกจากระบบ รวมเครื่องนี้ด้วย</div>
            </div>
            <div className="fld">
              <span className="lbl">รหัสผ่านเดิม</span>
              <input
                className="inp"
                type="password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">รหัสผ่านใหม่</span>
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
              <div className="hint">อย่างน้อย 10 ตัวอักษร</div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={busy || !me}>
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </form>

        <p className="auth-foot">
          <Link href="/workspaces">กลับไปหน้าที่ทำงานของฉัน</Link>
        </p>
      </div>
    </div>
  );
}
