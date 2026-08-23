'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { SettingsTabs } from '@/components/settings-tabs';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 08 · รายชื่อสมาชิก  ·  08ข การโอนสิทธิ์
 *
 * ตำแหน่งงาน (pm/dev/qa) กับบทบาท (owner/member/viewer/guest) เป็นคนละเรื่องกัน
 * ตำแหน่งงานไม่เคยเปลี่ยนสิทธิ์ของใครแม้แต่ครั้งเดียว ใช้แสดงผลและกรองเท่านั้น
 * จุดนี้พลาดบ่อยที่สุดในระบบ จึงแยกคอลัมน์ให้เห็นชัดว่าไม่ใช่อันเดียวกัน
 *
 * ตัวเลข "ถืออยู่" เป็นบริบท ไม่ใช่คะแนน — กฎข้อ 9 ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้
 */
interface Member {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'member' | 'viewer' | 'guest';
  jobTitle: string;
  active: boolean;
  holding: number;
  pmOf: string[];
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export default function MembersPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<Member[] | null>(null);
  const [me, setMe] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, ws] = await Promise.all([
        api.get<Member[]>(`/t/${tenant}/members`),
        api.get<{ yourRole: string }>(`/t/${tenant}/workspace`),
      ]);
      setRows(list);
      setMe(ws.yourRole);
    } catch (e) {
      setErr(errorText(e));
      setRows([]);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(userId: string, path: string) {
    setErr(null);
    try {
      await api.post(`/t/${tenant}/members/${userId}/${path}`);
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  const isOwner = me === 'owner';
  const owners = (rows ?? []).filter((m) => m.role === 'owner' && m.active).length;

  return (
    <>
      <PageHead
        title="สมาชิก"
        desc={rows === null ? 'กำลังโหลด…' : `${rows.length} คน · เข้าทีมได้ด้วยคำเชิญเท่านั้น`}
        right={
          isOwner ? (
            <Link href={`/${tenant}/settings/members/invite`} className="btn btn-pri btn-sm">
              ＋ เชิญสมาชิก
            </Link>
          ) : undefined
        }
      />
      <SettingsTabs base={`/${tenant}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card>
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>บทบาท</th>
              <th>ตำแหน่งงาน</th>
              <th>ถืออยู่</th>
              <th>เป็น PM ของ</th>
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((m) => (
              <tr key={m.userId} style={m.active ? undefined : { opacity: 0.5 }}>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      member={{
                        id: m.userId,
                        name: m.name,
                        initials: m.name.slice(0, 2),
                        email: m.email,
                        role: m.role,
                        jobTitle: 'other',
                        active: m.active,
                      }}
                      size="sm"
                    />
                    <span>
                      <span style={{ display: 'block', fontWeight: 500 }}>{m.name}</span>
                      <span className="sub mn" style={{ fontSize: 11.5 }}>
                        {m.email}
                      </span>
                    </span>
                  </span>
                </td>
                <td>
                  <span className={`chip ${m.role === 'owner' ? 'st-review' : ''}`}>
                    {ROLE_LABEL[m.role]}
                  </span>
                </td>
                {/* ตำแหน่งงานไม่ผูกกับสิทธิ์ — คนละคอลัมน์กับบทบาทโดยตั้งใจ */}
                <td className="sub mn">{m.jobTitle}</td>
                <td className="mn sub">{m.holding} ใบ</td>
                <td className="mn sub">{m.pmOf.join(' · ') || '—'}</td>
                {isOwner ? (
                  <td style={{ textAlign: 'right' }}>
                    {m.role === 'owner' ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-2"
                        onClick={() => act(m.userId, 'revoke-owner')}
                        disabled={owners <= 1}
                        title={owners <= 1 ? 'ต้องมีเจ้าของอย่างน้อยหนึ่งคน' : undefined}
                      >
                        ถอดจากเจ้าของ
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-2"
                        onClick={() => act(m.userId, 'grant-owner')}
                      >
                        แต่งตั้งเป็นเจ้าของ
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>
          <b>ตำแหน่งงานไม่ใช่สิทธิ์</b> — คนที่ตำแหน่ง “PM” ไม่ได้มีสิทธิ์มากกว่าคนอื่น สิทธิ์จริงอยู่ที่คอลัมน์บทบาท
          และการปิดการ์ดขึ้นกับว่าเป็น PM ของโปรเจกต์นั้นหรือเปล่า
        </div>
      </div>
    </>
  );
}
