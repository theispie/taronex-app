'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 02 · เข้าสู่ระบบ
 *
 * ข้อความผิดพลาดเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือรหัสผิด
 * ไม่งั้นหน้านี้กลายเป็นเครื่องมือไล่เช็คว่าอีเมลไหนมีบัญชีในระบบ
 *
 * ล็อกอินแล้วไปหน้ากลาง เพราะเซสชันไม่ผูกกับที่ทำงาน
 * คนที่อยู่หลายที่ทำงานต้องได้เลือกเองว่าจะเข้าที่ไหน
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/login', { email, password });
      router.push('/workspaces');
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 20 }}>
          เข้าสู่ระบบ
        </h1>

        <form className="card" onSubmit={submit}>
          <div className="card-b">
            {err ? (
              <div className="alert d" style={{ marginBottom: 14 }}>
                <span>✕</span>
                <div>{err}</div>
              </div>
            ) : null}

            <div className="fld">
              <span className="lbl">อีเมล</span>
              <input
                className="inp mn"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div className="fld" style={{ marginBottom: 16 }}>
              <span className="lbl">รหัสผ่าน</span>
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-pri btn-bl btn-lg" disabled={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <Link href="/forgot" className="sub">
                ลืมรหัสผ่าน
              </Link>
            </div>
          </div>
        </form>

        <p className="auth-alt">
          ยังไม่มีบัญชี? <Link href="/signup">สร้างที่ทำงานใหม่</Link>
        </p>
      </div>
    </div>
  );
}
