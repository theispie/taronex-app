'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AccountMenu, type AccountUser } from '@/components/account-menu';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 42 · หน้ากลาง — ที่ทำงานของฉัน
 *
 * ═══ หน้านี้จำเป็นทางเทคนิค ไม่ใช่แค่ความสะดวก ═══
 * เซสชันไม่ผูกกับที่ทำงาน ตอนล็อกอินระบบจึงยังไม่รู้ว่าจะพาไปที่ไหน
 * และคนที่เพิ่งออกจากที่ทำงานสุดท้ายต้องมีที่ให้ตกลง
 *
 * ป้ายบทบาทติดทุกแถว เพราะคนที่เข้าในฐานะแขกหรือผู้ชมต้องรู้**ก่อนกด**ว่าจะเห็นไม่ครบ
 * ไม่งั้นจะนึกว่าระบบพัง
 *
 * ตัวเลข "รอคุณ" เป็นสิ่งเดียวที่ข้ามที่ทำงานได้ เพราะเป็นการนับ ไม่ใช่การเอาข้อมูลมาปน (กฎข้อ 11)
 *
 * ═══ ยังไม่ได้ล็อกอิน = พาไปหน้าเข้าสู่ระบบ ไม่ใช่โชว์กล่องแดง ═══
 * เดิมหน้านี้แสดงข้อความผิดพลาดสีแดงพร้อมปุ่ม "สร้างที่ทำงานใหม่" ที่กดแล้วก็ไม่สำเร็จ
 * ซึ่งอ่านเหมือนระบบพัง ทั้งที่แค่ยังไม่ได้ล็อกอิน
 */
interface Workspace {
  tenantId: string;
  slug: string;
  name: string;
  role: string;
  status: string;
  members: number;
  projects: number;
  waitingOnYou: number;
}
interface Invite {
  tenantName: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string;
}
interface Me {
  user: AccountUser;
}

/** สีป้ายยกจากต้นแบบหน้าจอ 42 ไม่ได้คิดสีใหม่ */
const SQ_COLORS = ['#0EA5A4', '#5B5BD6', '#D97706', '#7C3AED', '#DC2626'];

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

/** อักษรย่อสองตัวจากชื่อบริษัท — ตัดคำนำหน้าอย่าง "บจก." ทิ้งก่อน */
function initials(name: string): string {
  const cleaned = name.replace(/^(บจก\.|บริษัท|ห้างหุ้นส่วน\S*)\s*/u, '').trim();
  return (cleaned || name).slice(0, 2);
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [list, setList] = useState<Workspace[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [who, ws, iv] = await Promise.all([
        api.get<Me>('/auth/me'),
        api.get<Workspace[]>('/me/workspaces'),
        api.get<Invite[]>('/me/invitations').catch(() => [] as Invite[]),
      ]);
      setMe(who);
      setList(ws);
      setInvites(iv);
    } catch (e) {
      if (e instanceof ApiCallError && e.code === 'E_UNAUTHENTICATED') {
        router.replace('/login');
        return;
      }
      setErr(errorText(e));
      setList([]);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ slug: string }>('/workspaces', { name: newName });
      router.push(`/${r.slug}`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  const firstName = me?.user.name.trim().split(/\s+/)[0] ?? '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="topbar">
        <span className="mark">T</span>
        <b style={{ fontSize: 15 }}>TaroNex</b>
        <AccountMenu user={me?.user ?? null} />
      </div>

      <div className="wspage">
        <h1>{firstName ? `สวัสดี ${firstName}` : 'ที่ทำงานของฉัน'}</h1>
        <p className="sub" style={{ marginBottom: 24 }}>
          เลือกที่ทำงานที่ต้องการเข้า
        </p>

        {err ? (
          <div className="alert e" style={{ marginBottom: 16 }}>
            <span>✕</span>
            <div>{err}</div>
          </div>
        ) : null}

        {list === null ? (
          <div className="ws-grid">
            <div className="card">
              <div className="card-b">
                <div className="hint">กำลังโหลด…</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {list.length > 0 ? (
              <div className="grp">ที่ทำงานของคุณ</div>
            ) : (
              <div className="alert i" style={{ marginBottom: 14 }}>
                <span>ℹ</span>
                <div>ยังไม่ได้อยู่ที่ทำงานไหน — สร้างใหม่ได้เลย หรือถ้ามีทีมที่จะเข้าร่วม ให้รอคำเชิญจากเขา</div>
              </div>
            )}
            <div className="ws-grid">
              {list.map((w, i) => (
                <Link key={w.tenantId} href={`/${w.slug}`} className="ws-tile">
                  <span className="top">
                    <span className="sq" style={{ background: SQ_COLORS[i % SQ_COLORS.length] }}>
                      {initials(w.name)}
                    </span>
                    <span className="chip">{ROLE_LABEL[w.role] ?? w.role}</span>
                  </span>

                  <span className="nm" style={{ display: 'block' }}>
                    {w.name}
                  </span>

                  <span className="foot">
                    <span className="hint" style={{ margin: 0, flex: 1 }}>
                      {w.role === 'guest'
                        ? `เห็น ${w.projects} โปรเจกต์`
                        : w.role === 'viewer'
                          ? `ดูได้อย่างเดียว · ${w.projects} โปรเจกต์`
                          : `${w.members} สมาชิก · ${w.projects} โปรเจกต์`}
                    </span>
                    {w.waitingOnYou > 0 ? (
                      <span className="chip st-doing">รอคุณ {w.waitingOnYou}</span>
                    ) : null}
                  </span>
                </Link>
              ))}

              {!creating ? (
                <button type="button" className="ws-tile new" onClick={() => setCreating(true)}>
                  <span>
                    ＋
                    <br />
                    สร้างที่ทำงานใหม่
                  </span>
                </button>
              ) : null}
            </div>
          </>
        )}

        {invites.length > 0 ? (
          <>
            <div className="grp">คำเชิญที่รอคุณตอบ</div>
            <div className="card" style={{ marginBottom: 22, borderColor: 'var(--brand)' }}>
              {invites.map((iv) => (
                <div className="ws-row" key={`${iv.tenantName}-${iv.role}`}>
                  <span className="sq" style={{ background: '#DC2626' }}>
                    {initials(iv.tenantName)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="nm" style={{ display: 'block' }}>
                      {iv.tenantName}
                    </span>
                    <span className="hint" style={{ margin: 0 }}>
                      {iv.invitedByName ? `${iv.invitedByName} เชิญเป็น ` : 'เชิญเป็น '}
                      <b>{ROLE_LABEL[iv.role] ?? iv.role}</b> · เหลือเวลาอีก {daysLeft(iv.expiresAt)}{' '}
                      วัน
                    </span>
                  </span>
                </div>
              ))}
              <div className="card-b">
                <div className="hint">
                  รับคำเชิญได้จากลิงก์ในอีเมลเท่านั้น — ลิงก์คือหลักฐานว่าคำเชิญนี้ส่งถึงคุณจริง
                  <br />
                  ตอนนี้ยังไม่ได้ต่อบริการส่งอีเมล ถ้ายังไม่ได้รับ ให้ขอลิงก์จากคนที่เชิญโดยตรง
                </div>
              </div>
            </div>
          </>
        ) : null}

        {creating ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-h">
              <b>สร้างที่ทำงานใหม่</b>
            </div>
            <div className="card-b">
              <form onSubmit={create}>
                <div className="fld">
                  <label className="lbl" htmlFor="wsname">
                    ชื่อบริษัท / ทีม
                  </label>
                  <input
                    id="wsname"
                    className="inp"
                    placeholder="ดิจิทัลเอ็กซ์ จำกัด"
                    value={newName}
                    onChange={(ev) => setNewName(ev.target.value)}
                    required
                  />
                  <div className="hint">เปลี่ยนทีหลังได้ที่หน้าตั้งค่าที่ทำงาน</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn btn-pri" disabled={busy || !newName.trim()}>
                    สร้าง
                  </button>
                  <button type="button" className="btn btn-2" onClick={() => setCreating(false)}>
                    ยกเลิก
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <p
          style={{
            textAlign: 'center',
            fontSize: 11.5,
            color: 'var(--faint)',
            marginTop: 20,
          }}
        >
          เข้าที่ทำงานใหม่ได้ด้วยคำเชิญเท่านั้น · ระบบไม่มีรายชื่อบริษัทให้ค้นหา
        </p>
      </div>
    </div>
  );
}
