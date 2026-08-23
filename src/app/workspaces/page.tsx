'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 42 · หน้ากลาง — ที่ทำงานของฉัน
 *
 * เซสชันไม่ผูกกับที่ทำงาน คนที่อยู่หลายที่จึงล็อกอินครั้งเดียวแล้วเลือกเอง
 * รายการมาจาก GET /me/workspaces ซึ่งเป็นหนึ่งในสี่เส้นทางที่ข้าม tenant ได้ (กฎข้อ 11)
 * คำเชิญที่ค้างอยู่มาจาก GET /me/invitations
 */
interface Workspace {
  tenantId: string;
  slug: string;
  name: string;
  role: string;
  status: string;
}
interface Invite {
  tenantName: string;
  role: string;
  invitedByName: string | null;
}

/** สีป้ายยกจากต้นแบบหน้าจอ 42 ไม่ได้คิดสีใหม่ */
const SQ_COLORS = ['#5B5BD6', '#0EA5A4', '#D97706', '#DC2626', '#2563EB'];

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export default function WorkspacesPage() {
  const router = useRouter();
  const [list, setList] = useState<Workspace[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const [ws, iv] = await Promise.all([
        api.get<Workspace[]>('/me/workspaces'),
        api.get<Invite[]>('/me/invitations').catch(() => [] as Invite[]),
      ]);
      setList(ws);
      setInvites(iv);
    } catch (e) {
      setErr(errorText(e));
      setList([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post<{ next: string }>('/workspaces', { name: newName });
      router.push(r.next);
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    router.push('/login');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ maxWidth: 460 }}>
        <div className="auth-brand" style={{ marginBottom: 18 }}>
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 4 }}>
          ที่ทำงานของฉัน
        </h1>
        <p className="sub" style={{ marginBottom: 18 }}>
          เข้าสู่ระบบครั้งเดียว ใช้ได้ทุกที่ทำงานที่คุณอยู่
        </p>

        {err ? (
          <div className="alert d" style={{ marginBottom: 14 }}>
            <span>✕</span>
            <div>
              {err}
              {' · '}
              <Link href="/login">เข้าสู่ระบบ</Link>
            </div>
          </div>
        ) : null}

        {list === null ? (
          <div className="hint">กำลังโหลด…</div>
        ) : list.length === 0 && !err ? (
          <div className="empty">ยังไม่ได้อยู่ที่ทำงานไหน สร้างใหม่ได้ข้างล่าง</div>
        ) : (
          <div className="card">
            {list.map((w, i) => (
              <Link key={w.tenantId} href={`/${w.slug}`} className="ws-row">
                <span className="sq" style={{ background: SQ_COLORS[i % SQ_COLORS.length] }}>
                  {w.name.slice(0, 2)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontWeight: 500 }}>{w.name}</span>
                  <span className="sub" style={{ display: 'block', fontSize: 12 }}>
                    {ROLE_LABEL[w.role] ?? w.role}
                    {w.status === 'trial' ? ' · ทดลองใช้' : ''}
                  </span>
                </span>
                <span className="mn sub" style={{ fontSize: 11.5 }}>
                  {w.slug}
                </span>
                <span style={{ color: 'var(--faint)' }}>›</span>
              </Link>
            ))}
          </div>
        )}

        {invites.length > 0 ? (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-h">
              <b>คำเชิญที่รอคุณอยู่</b>
            </div>
            <div className="card-b">
              {invites.map((iv) => (
                <div className="kv" key={`${iv.tenantName}-${iv.role}`}>
                  <span>
                    <b>{iv.tenantName}</b>
                    {iv.invitedByName ? ` · ${iv.invitedByName} เชิญ` : ''}
                  </span>
                  <span className="chip">{ROLE_LABEL[iv.role] ?? iv.role}</span>
                </div>
              ))}
              <div className="hint" style={{ marginTop: 8 }}>
                กดลิงก์ในอีเมลเพื่อรับคำเชิญ
              </div>
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <b>สร้างที่ทำงานใหม่</b>
          </div>
          <div className="card-b">
            {creating ? (
              <form onSubmit={create}>
                <div className="fld">
                  <span className="lbl">ชื่อบริษัท / ทีม</span>
                  <input
                    className="inp"
                    value={newName}
                    onChange={(ev) => setNewName(ev.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-pri">
                    สร้าง
                  </button>
                  <button type="button" className="btn btn-2" onClick={() => setCreating(false)}>
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="btn btn-2" onClick={() => setCreating(true)}>
                ＋ สร้างที่ทำงานใหม่
              </button>
            )}
          </div>
        </div>

        <p className="auth-foot">ไม่มีรายชื่อบริษัทให้ค้นหา — เข้าที่ทำงานได้ด้วยคำเชิญเท่านั้น</p>

        <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
          <Link href="/account" className="sub">
            ตั้งค่าบัญชี
          </Link>
          <button
            type="button"
            className="sub"
            style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
            onClick={logout}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}
