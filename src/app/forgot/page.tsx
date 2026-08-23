'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 03 · ลืมรหัสผ่าน
 *
 * ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือไม่
 * ถ้าตอบต่างกัน หน้านี้จะกลายเป็นเครื่องมือไล่เช็คว่าใครมีบัญชีในระบบ
 */
export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/forgot', { email });
      setSent(true);
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
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
          ลืมรหัสผ่าน
        </h1>

        {sent ? (
          <div className="card">
            <div className="card-b">
              <div className="alert o">
                <span>✓</span>
                <div>ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสใหม่ไปให้แล้ว</div>
              </div>
              <p className="sub" style={{ marginTop: 12 }}>
                ลิงก์มีอายุ 2 ชั่วโมง และใช้ได้ครั้งเดียว
              </p>
            </div>
          </div>
        ) : (
          <form className="card" onSubmit={submit}>
            <div className="card-b">
              {err ? (
                <div className="alert d" style={{ marginBottom: 14 }}>
                  <span>✕</span>
                  <div>{err}</div>
                </div>
              ) : null}
              <div className="fld" style={{ marginBottom: 16 }}>
                <span className="lbl">อีเมลที่ใช้สมัคร</span>
                <input
                  className="inp mn"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-pri btn-bl btn-lg" disabled={busy}>
                {busy ? 'กำลังส่ง…' : 'ส่งลิงก์ตั้งรหัสใหม่'}
              </button>
            </div>
          </form>
        )}

        <p className="auth-alt">
          <Link href="/login">กลับไปหน้าเข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
