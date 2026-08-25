'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AccountUser, initialsOf } from '@/components/account-menu';
import { AppTopbar } from '@/components/app-topbar';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 43 · ตั้งค่าบัญชีส่วนตัว
 *
 * แยกจากตั้งค่าที่ทำงานโดยตั้งใจ — ชื่อกับรหัสผ่านเป็นของคน ไม่ใช่ของบริษัท
 * ตำแหน่งงานไม่ได้อยู่ที่นี่ เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน
 * (อยู่ที่หน้าโปรไฟล์ในแต่ละที่ทำงานแทน)
 */
interface Me {
  user: AccountUser;
}

/** ต้องตรงกับ MAX_AVATAR_BYTES ที่ `src/lib/avatar.ts` */
const MAX_AVATAR_BYTES = 512 * 1024;
const ACCEPT = 'image/png,image/jpeg,image/webp';

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<Me>('/auth/me');
      setMe(d.user);
      setName(d.user.name);
    } catch (e) {
      if (e instanceof ApiCallError && e.code === 'E_UNAUTHENTICATED') {
        router.replace('/login');
        return;
      }
      setErr(errorText(e));
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * ส่งเนื้อไฟล์ดิบไปตรงๆ ไม่ห่อเป็น multipart
   * เซิร์ฟเวอร์ตรวจชนิดจาก magic bytes อยู่แล้ว จึงไม่ต้องพึ่งชื่อหรือ Content-Type
   */
  async function uploadAvatar(file: File) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (file.size > MAX_AVATAR_BYTES) {
        throw new Error('รูปโปรไฟล์ต้องไม่เกิน 512 KB — ลองย่อรูปก่อนอัป');
      }
      const res = await fetch('/app/api/v1/account/avatar', {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'อัปรูปไม่สำเร็จ');
      setMsg('เปลี่ยนรูปโปรไฟล์แล้ว');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.del('/account/avatar');
      setMsg('เอารูปออกแล้ว · กลับไปใช้อักษรย่อ');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <AppTopbar user={me} />

      <div className="wspage">
        <h1>ตั้งค่าบัญชี</h1>
        <p className="sub" style={{ marginBottom: 24 }}>
          ข้อมูลของคุณ ไม่ใช่ของที่ทำงานใดที่ทำงานหนึ่ง
        </p>

        {err ? (
          <div className="alert e" style={{ marginBottom: 14 }}>
            <span>✕</span>
            <div>{err}</div>
          </div>
        ) : null}
        {msg ? (
          <div className="alert s" style={{ marginBottom: 14 }}>
            <span>✓</span>
            <div>{msg}</div>
          </div>
        ) : null}

        <div className="card mb">
          <div className="card-h">
            <b>รูปโปรไฟล์</b>
          </div>
          <div className="card-b" style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            {me?.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: รูปมาจากที่เก็บไฟล์ ไม่ผ่าน next/image
              <img className="av-big" src={me.avatarUrl} alt="รูปโปรไฟล์ของคุณ" />
            ) : (
              <span className="av-big fallback">{me ? initialsOf(me) : ''}</span>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                style={{ display: 'none' }}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button
                  type="button"
                  className="btn btn-2 btn-sm"
                  disabled={busy || !me}
                  onClick={() => fileRef.current?.click()}
                >
                  {me?.avatarUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                </button>
                {me?.avatarUrl ? (
                  <button
                    type="button"
                    className="btn btn-gh btn-sm"
                    disabled={busy}
                    onClick={() => void removeAvatar()}
                  >
                    เอารูปออก
                  </button>
                ) : null}
              </div>
              <div className="hint">
                PNG · JPG · WebP ไม่เกิน 512 KB · ไม่รับ SVG เพราะเปิดช่องให้ฝังสคริปต์ได้
                <br />
                ไม่อัปก็ได้ — ระบบจะใช้อักษรย่อจากชื่อคุณ (ไทยหรืออังกฤษก็ได้) ถ้าไม่มีชื่อจะใช้สองตัวแรกของอีเมล
              </div>
            </div>
          </div>
        </div>

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

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/workspaces" className="sub">
            ← กลับไปหน้าที่ทำงานของฉัน
          </Link>
        </p>
      </div>
    </div>
  );
}
