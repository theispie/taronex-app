'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 01 · สมัครใช้งาน
 * สมัคร 1 ครั้ง = สร้าง tenant ใหม่ทันที ไม่มีขั้น "เลือกแผน" มาขวาง
 * ชื่อบริษัทกรอกก่อนชื่อคน เพราะคนที่สมัครคือเจ้าของ ไม่ใช่พนักงาน
 *
 * ต่อกับ POST /api/v1/auth/signup แล้ว — ไม่ใช่ข้อมูลจำลอง
 */
export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ความยาวคือสิ่งที่สำคัญที่สุดของรหัสผ่าน แถบนี้จึงวัดจากความยาวล้วน
  const strength = Math.min(4, Math.floor(password.length / 4));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ next: string }>('/auth/signup', {
        companyName,
        name,
        email,
        password,
      });
      router.push(r.next);
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
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>
          สร้างที่ทำงานใหม่
        </h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          ทดลองฟรี 14 วัน ไม่ต้องใส่บัตร
        </p>

        <form className="card" onSubmit={submit}>
          <div className="card-b">
            {err ? (
              <div className="alert d" style={{ marginBottom: 14 }}>
                <span>✕</span>
                <div>{err}</div>
              </div>
            ) : null}

            <div className="fld">
              <span className="lbl">ชื่อบริษัท / ทีม</span>
              <input
                className="inp"
                value={companyName}
                onChange={(ev) => setCompanyName(ev.target.value)}
                placeholder="ดิจิทัลเอ็กซ์ จำกัด"
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">ที่อยู่ที่ทำงาน</span>
              <div className="addr-group">
                <span className="addr-prefix mn">taronex.theerawut.com/app/</span>
                <input className="inp mn addr-input" value="ระบบสุ่มให้ตอนสร้าง" readOnly />
              </div>
              <div className="hint">ระบบสุ่มรหัสให้อัตโนมัติ · ตั้งชื่อเองได้ในเวอร์ชันถัดไป</div>
            </div>
            <div className="fld">
              <span className="lbl">ชื่อของคุณ</span>
              <input
                className="inp"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="พีรพล วงศ์สถาพร"
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">อีเมลที่ทำงาน</span>
              <input
                className="inp mn"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="peerapon@digitalx.co.th"
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
              <div className="pwmeter">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={i < strength ? 'on' : undefined} />
                ))}
              </div>
              <div className="hint">อย่างน้อย 10 ตัวอักษร</div>
            </div>
            <button type="submit" className="btn btn-pri btn-bl btn-lg" disabled={busy}>
              {busy ? 'กำลังสร้าง…' : 'สร้างที่ทำงาน'}
            </button>
            <p className="auth-terms">การสร้างบัญชีถือว่ายอมรับเงื่อนไขการใช้งาน</p>
          </div>
        </form>

        <p className="auth-alt">
          มีบัญชีอยู่แล้ว? <Link href="/login">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
