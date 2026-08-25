'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SettingsTabs } from '@/components/settings-tabs';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 08ข · สมาชิก — บทบาทและการโอนสิทธิ์
 *
 * เจ้าของมีได้หลายคน — ถ้าเจ้าของคนเดียวลาออกหรือลืมรหัส ทั้งบริษัทติดล็อกทันที
 * ผู้ชมกับแขกเป็นคนละปัญหา: ผู้ชม = "เห็นแต่แตะไม่ได้" · แขก = "ไม่เห็นเลย"
 *
 * ═══ กฎข้อ 12 ═══
 * ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ **บังคับด้วย trigger ที่ฐานข้อมูล**
 * ปุ่มที่ปิดไว้ตอนเหลือเจ้าของคนเดียวเป็นแค่ความสุภาพกับคนใช้ ไม่ใช่กลไกป้องกัน
 * ต่อให้ยิง API ตรงข้ามหน้าเว็บไป ฐานข้อมูลก็ยังปฏิเสธอยู่ดี
 */
interface Member {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member' | 'viewer' | 'guest';
  jobTitle: string;
  active: boolean;
  pmOf: string[];
}

const ROLES = [
  {
    key: 'owner',
    name: 'เจ้าของ',
    sees: 'เห็นทุกอย่าง และจัดการที่ทำงาน สมาชิก แผน และการชำระเงินได้',
  },
  {
    key: 'member',
    name: 'สมาชิก',
    sees: 'เห็นทุกโปรเจกต์ และร่วมงานได้ตามที่แต่ละโปรเจกต์ตั้งไว้',
  },
  { key: 'viewer', name: 'ผู้ชม', sees: 'เห็นทุกโปรเจกต์ แต่กดแก้อะไรไม่ได้เลย' },
  {
    key: 'guest',
    name: 'แขก',
    sees: 'เห็นเฉพาะโปรเจกต์ที่ถูกเชิญเข้ามาโดยตรง ไม่มีหน้าจอข้ามโปรเจกต์',
  },
];

export default function RolesPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<Member[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Member[]>(`/t/${tenant}/members`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const active = (rows ?? []).filter((m) => m.active);
  const owners = active.filter((m) => m.role === 'owner');
  const others = active.filter((m) => m.role !== 'owner');

  const avatarOf = (m: Member) => ({
    id: m.userId,
    name: m.name,
    initials: m.name.slice(0, 2),
    email: m.email,
    role: 'member' as const,
    jobTitle: 'other' as const,
    active: true,
  });

  return (
    <>
      <PageHead title="บทบาทและสิทธิ์" desc="ใครเห็นอะไร และโอนความเป็นเจ้าของ" />
      <SettingsTabs base={`/${tenant}`} />

      {err ? <div className="alert e">{err}</div> : null}

      <Card className="mb">
        <div className="card-h">
          <b>แต่ละบทบาทเห็นอะไร</b>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>บทบาท</th>
              <th>เห็นอะไร</th>
              <th style={{ width: 90 }}>ตอนนี้มี</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.key}>
                <td>
                  <span className={`chip ${r.key === 'owner' ? 'st-review' : ''}`}>{r.name}</span>
                </td>
                <td className="sub">{r.sees}</td>
                <td className="sub mn">
                  {rows ? `${active.filter((m) => m.role === r.key).length} คน` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="card-h">
          <b>เจ้าของที่ทำงาน</b>
          <div className="r">
            <button
              type="button"
              className="btn btn-2 btn-sm"
              disabled={busy || others.length === 0}
              onClick={() => setPicking((x) => !x)}
            >
              ＋ แต่งตั้งเจ้าของเพิ่ม
            </button>
          </div>
        </div>

        {picking ? (
          <div className="card-b">
            <p className="sub" style={{ marginBottom: 8 }}>
              แต่งตั้งแล้วมีผลทันที ไม่ต้องรอปลายทางกดรับ
            </p>
            {others.map((m) => (
              <div key={m.userId} className="row">
                <Avatar member={avatarOf(m)} size="sm" />
                <span className="row-title">{m.name}</span>
                <span className="mn sub">{m.email}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-2"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.post(`/t/${tenant}/members/${m.userId}/grant-owner`);
                      setPicking(false);
                    })
                  }
                >
                  แต่งตั้ง
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {rows === null ? (
          <div className="card-b">
            <div className="empty">กำลังโหลด…</div>
          </div>
        ) : (
          owners.map((m) => (
            <div key={m.userId} className="row">
              <Avatar member={avatarOf(m)} size="sm" />
              <span className="row-title">{m.name}</span>
              <span className="mn sub">{m.email}</span>
              {m.pmOf.length > 0 ? (
                <span className="sub mn">PM ของ {m.pmOf.join(' · ')}</span>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-dn"
                disabled={busy || owners.length <= 1}
                title={owners.length <= 1 ? 'ถอดไม่ได้ ต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ' : ''}
                onClick={() =>
                  void run(() => api.post(`/t/${tenant}/members/${m.userId}/revoke-owner`))
                }
              >
                ถอดสิทธิ์เจ้าของ
              </button>
            </div>
          ))
        )}

        <div className="card-b">
          <div className="alert w">
            <span>⚠</span>
            <div>
              ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ — <b>บังคับที่ระดับฐานข้อมูล</b> ไม่ใช่แค่ซ่อนปุ่ม ต่อให้ยิง API
              ตรงข้ามหน้านี้ไปก็ยังถูกปฏิเสธ
              <br />
              เจ้าของคนเดียวลาออกหรือลืมรหัส = ทั้งบริษัทติดล็อก แนะนำให้มีอย่างน้อยสองคน
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
