'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AccountUser, initialsOf } from '@/components/account-menu';
import { AppTopbar } from '@/components/app-topbar';
import { ApiCallError, api, errorText } from '@/lib/api-client';
import { LOCALE_LABEL, LOCALES, useT } from '@/lib/i18n';

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
  const { t, locale } = useT();
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
        throw new Error(t('acct.avatarTooBig'));
      }
      const res = await fetch('/app/api/v1/account/avatar', {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? 'อัปรูปไม่สำเร็จ');
      setMsg(t('acct.avatarSaved'));
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
      setMsg(t('acct.avatarRemoved'));
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
      setMsg(t('acct.saved'));
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
        <h1>{t('acct.title')}</h1>
        <p className="sub" style={{ marginBottom: 24 }}>
          {t('acct.desc')}
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
            <b>{t('acct.avatar')}</b>
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
                  {me?.avatarUrl ? t('acct.change') : t('acct.upload')}
                </button>
                {me?.avatarUrl ? (
                  <button
                    type="button"
                    className="btn btn-gh btn-sm"
                    disabled={busy}
                    onClick={() => void removeAvatar()}
                  >
                    {t('acct.remove')}
                  </button>
                ) : null}
              </div>
              <div className="hint">
                {t('acct.avatarHint')}
                <br />
                {t('acct.avatarHint2')}
              </div>
            </div>
          </div>
        </div>

        <form className="card" onSubmit={saveName} style={{ marginBottom: 16 }}>
          <div className="card-h">
            <b>{t('acct.profile')}</b>
          </div>
          <div className="card-b">
            <div className="fld">
              <span className="lbl">{t('acct.name')}</span>
              <input
                className="inp"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">{t('acct.email')}</span>
              <input className="inp mn" value={me?.email ?? ''} readOnly />
              <div className="hint">{t('acct.emailHint')}</div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={busy || !me}>
              {t('acct.save')}
            </button>
          </div>
        </form>

        <div className="card mb">
          <div className="card-h">
            <b>{t('account.language')}</b>
          </div>
          <div className="card-b">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={l === locale ? 'btn btn-pri btn-sm' : 'btn btn-2 btn-sm'}
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      if (l === locale) return;
                      await api.put('/account/locale', { locale: l }).catch(() => {});
                      router.refresh();
                    })()
                  }
                >
                  {LOCALE_LABEL[l]}
                </button>
              ))}
            </div>
            <div className="hint">{t('acct.languageHint')}</div>
          </div>
        </div>

        <form className="card" onSubmit={changePassword}>
          <div className="card-h">
            <b>{t('acct.changePassword')}</b>
          </div>
          <div className="card-b">
            <div className="alert i" style={{ marginBottom: 12 }}>
              <span>ℹ</span>
              <div>{t('acct.passwordWarn')}</div>
            </div>
            <div className="fld">
              <span className="lbl">{t('acct.currentPassword')}</span>
              <input
                className="inp"
                type="password"
                value={currentPassword}
                onChange={(ev) => setCurrentPassword(ev.target.value)}
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">{t('acct.newPassword')}</span>
              <input
                className="inp"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
              <div className="hint">{t('acct.passwordHint')}</div>
            </div>
            <button type="submit" className="btn btn-pri" disabled={busy || !me}>
              {t('acct.changePassword')}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/workspaces" className="sub">
            {t('acct.back')}
          </Link>
        </p>
      </div>
    </div>
  );
}
