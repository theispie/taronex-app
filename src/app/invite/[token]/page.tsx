'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 05 · รับคำเชิญเข้าทีม  ·  หน้าจอ 44 เมื่ออีเมลไม่ตรง
 *
 * ═══ รับคำเชิญไม่ใช่การสมัคร ═══
 * เส้นทางนี้ต้องไม่สร้างที่ทำงานใหม่เด็ดขาด ถ้าพลาดคนที่รับคำเชิญจะได้
 * ที่ทำงานของตัวเองแทนที่จะเข้าทีมที่เชิญมา แล้วจะงงกันทั้งสองฝ่าย
 *
 * ถ้าอีเมลที่ล็อกอินอยู่ไม่ตรงกับคำเชิญ ต้องบอกให้ชัดว่าคำเชิญส่งถึงใคร
 * แล้วเสนอให้สลับบัญชี ไม่ใช่แค่บอกว่า "ไม่มีสิทธิ์"
 */
interface InviteView {
  tenantName: string;
  email: string;
  role: string;
  invitedByName: string | null;
}
interface Me {
  user: { email: string; name: string };
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export default function InvitePage() {
  const token = String(useParams().token ?? '');
  const router = useRouter();
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<InviteView>(`/invitations/${token}`)
      .then(setInvite)
      .catch((e) => setLoadErr(errorText(e)));
    api
      .get<Me>('/auth/me')
      .then((d) => setMe(d.user))
      .catch(() => setMe(null));
  }, [token]);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ next: string }>(`/invitations/${token}/accept`);
      router.push(r.next);
    } catch (e2) {
      if (e2 instanceof ApiCallError && e2.status === 401) {
        router.push('/login');
        return;
      }
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  const mismatch = me !== null && invite !== null && me.email !== invite.email;

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>

        {loadErr ? (
          <>
            <h1 className="auth-h1" style={{ marginBottom: 8 }}>
              คำเชิญนี้ใช้ไม่ได้แล้ว
            </h1>
            <p className="sub" style={{ marginBottom: 18 }}>
              {loadErr} · คำเชิญมีอายุ 7 วัน และใช้ได้ครั้งเดียว
            </p>
            <div className="card">
              <div className="card-b">
                <p className="sub">ขอให้คนในทีมส่งคำเชิญใหม่ให้อีกครั้ง</p>
              </div>
            </div>
          </>
        ) : invite === null ? (
          <div className="hint">กำลังโหลดคำเชิญ…</div>
        ) : (
          <>
            <h1 className="auth-h1" style={{ marginBottom: 4 }}>
              {invite.invitedByName ? `${invite.invitedByName} ชวนคุณ` : 'คุณได้รับคำเชิญ'}
            </h1>
            <p className="sub" style={{ marginBottom: 18 }}>
              เข้าร่วม <b>{invite.tenantName}</b> ในฐานะ {ROLE_LABEL[invite.role] ?? invite.role}
            </p>

            <div className="card">
              <div className="card-b">
                {err ? (
                  <div className="alert d" style={{ marginBottom: 14 }}>
                    <span>✕</span>
                    <div>{err}</div>
                  </div>
                ) : null}

                <div className="kvbox">
                  <div className="kv">
                    <span>ที่ทำงาน</span>
                    <b>{invite.tenantName}</b>
                  </div>
                  <div className="kv">
                    <span>คำเชิญส่งถึง</span>
                    <b className="mn">{invite.email}</b>
                  </div>
                </div>

                {me === null ? (
                  <>
                    <p className="sub" style={{ margin: '14px 0 10px' }}>
                      เข้าสู่ระบบด้วยอีเมล <span className="mn">{invite.email}</span> เพื่อรับคำเชิญ
                    </p>
                    <Link href="/login" className="btn btn-pri btn-bl btn-lg">
                      เข้าสู่ระบบ
                    </Link>
                    <Link href="/signup" className="btn btn-2 btn-bl" style={{ marginTop: 8 }}>
                      ยังไม่มีบัญชี — สมัครใหม่
                    </Link>
                  </>
                ) : mismatch ? (
                  <>
                    {/* หน้าจอ 44 — บอกให้ชัดว่าต้องสลับไปบัญชีไหน ไม่ใช่แค่ปฏิเสธ */}
                    <div className="alert w" style={{ margin: '14px 0' }}>
                      <span>⚠</span>
                      <div>
                        คุณเข้าสู่ระบบด้วย <span className="mn">{me.email}</span> แต่คำเชิญนี้ส่งถึง{' '}
                        <span className="mn">{invite.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-pri btn-bl btn-lg"
                      onClick={async () => {
                        await api.post('/auth/logout').catch(() => {});
                        router.push('/login');
                      }}
                    >
                      สลับไปบัญชี {invite.email}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="sub" style={{ margin: '14px 0 10px' }}>
                      เข้าใช้งานเป็น <b>{me.name}</b> · <span className="mn">{me.email}</span>
                    </p>
                    <button
                      type="button"
                      className="btn btn-pri btn-bl btn-lg"
                      onClick={accept}
                      disabled={busy}
                    >
                      {busy ? 'กำลังเข้าร่วม…' : `เข้าร่วม ${invite.tenantName}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <p className="auth-foot mn">เข้าที่ทำงานได้ด้วยคำเชิญเท่านั้น ไม่มีไดเรกทอรีให้ค้นหา</p>
      </div>
    </div>
  );
}
