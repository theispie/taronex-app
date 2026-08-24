'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 06 · ทางเข้าลูกค้า (ไม่ใช้รหัสผ่าน)
 *
 * ไม่ใช้รหัสผ่าน เพราะคนของลูกค้าเข้าปีละไม่กี่ครั้ง ตั้งรหัสไปก็ลืม
 * แล้วจะจบที่โทรหาทีมให้รีเซ็ตให้ ซึ่งแพงกว่าการส่งลิงก์
 *
 * ⚠ ข้อความหลังกดส่ง **เหมือนกันเสมอ** ไม่ว่าอีเมลนั้นจะลงทะเบียนไว้หรือไม่
 * ถ้าต่างกัน ใครก็ได้จะยิงรายชื่ออีเมลเข้ามาแล้วรู้ว่าบริษัทไหนเป็นลูกค้าของเอเจนซี่รายนี้
 */
function LoginInner() {
  const slug = String(useParams().slug ?? '');
  const router = useRouter();
  const token = useSearchParams().get('token');

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const redeem = useCallback(
    async (t: string) => {
      setBusy(true);
      try {
        await api.post(`/portal/${slug}/verify`, { token: t });
        router.replace(`/portal/${slug}`);
      } catch (e) {
        setErr(errorText(e));
        setBusy(false);
      }
    },
    [slug, router],
  );

  // มากับลิงก์ในอีเมล — แลกเป็นเซสชันแล้วเข้าไปเลย ไม่ต้องให้กดอะไรอีก
  useEffect(() => {
    if (token) void redeem(token);
  }, [token, redeem]);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/portal/${slug}/request-link`, { email });
      setSent(true);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap" style={{ background: '#F7FAFA' }}>
      <div className="auth-box">
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>
          เข้าดูเรื่องที่แจ้งไว้
        </h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          ไม่ต้องใช้รหัสผ่าน
        </p>

        <div className="pw-card">
          <div className="card-b">
            {err ? <div className="alert e">{err}</div> : null}
            {sent ? (
              <div className="alert s">ถ้าอีเมลนี้ลงทะเบียนไว้ ลิงก์เข้าใช้งานจะถูกส่งไปภายในไม่กี่นาที</div>
            ) : (
              <>
                <div className="fld">
                  <label className="lbl" htmlFor="pe">
                    อีเมลของคุณ
                  </label>
                  <input
                    id="pe"
                    className="inp mn"
                    type="email"
                    placeholder="somying@thongthai.co.th"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <div className="hint">ใช้อีเมลที่ทีมงานลงทะเบียนไว้ให้</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ws btn-bl btn-lg"
                  disabled={busy || !email.trim()}
                  onClick={() => void send()}
                >
                  ส่งลิงก์เข้าใช้งาน
                </button>
                <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
                  ลิงก์ใช้ได้ครั้งเดียว มีอายุ 24 ชั่วโมง
                </p>
              </>
            )}
          </div>
        </div>

        <p className="auth-foot">อีเมลไม่มา? ติดต่อทีมงานในเวลาทำการ</p>
      </div>
    </div>
  );
}

export default function PortalLogin() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
