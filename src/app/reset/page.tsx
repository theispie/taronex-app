'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 04 · ตั้งรหัสผ่านใหม่
 *
 * ตั้งสำเร็จแล้วเซสชันทุกเครื่องตายหมด รวมเครื่องนี้ด้วย
 * เพราะถ้ารหัสหลุด การเปลี่ยนรหัสต้องเตะคนที่สวมสิทธิ์อยู่ออกไปด้วย
 */
function ResetForm() {
  const token = useSearchParams().get('t') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post('/auth/reset', { token, password });
      setDone(true);
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card">
        <div className="card-b">
          <div className="alert o">
            <span>✓</span>
            <div>ตั้งรหัสใหม่แล้ว · เครื่องอื่นที่ค้างอยู่ถูกให้ออกจากระบบทั้งหมด</div>
          </div>
          <Link href="/login" className="btn btn-pri btn-bl" style={{ marginTop: 14 }}>
            เข้าสู่ระบบด้วยรหัสใหม่
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="card-b">
        {err ? (
          <div className="alert d" style={{ marginBottom: 14 }}>
            <span>✕</span>
            <div>{err}</div>
          </div>
        ) : null}
        {!token ? (
          <div className="alert w" style={{ marginBottom: 14 }}>
            <span>⚠</span>
            <div>ลิงก์นี้ไม่สมบูรณ์ กรุณาขอลิงก์ใหม่จากหน้าลืมรหัสผ่าน</div>
          </div>
        ) : null}
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
        <div className="fld" style={{ marginBottom: 16 }}>
          <span className="lbl">พิมพ์อีกครั้ง</span>
          <input
            className="inp"
            type="password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-pri btn-bl btn-lg" disabled={busy || !token}>
          {busy ? 'กำลังตั้งรหัส…' : 'ตั้งรหัสผ่านใหม่'}
        </button>
      </div>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 20 }}>
          ตั้งรหัสผ่านใหม่
        </h1>
        <Suspense fallback={<div className="hint">กำลังโหลด…</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
