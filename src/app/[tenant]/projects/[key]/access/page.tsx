'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 45 · สิทธิ์การเข้าถึงโปรเจกต์
 *
 * ค่าเริ่มต้นระดับโปรเจกต์ + รายชื่อยกเว้น พูดเป็นประโยคเดียวได้
 * และไม่เกิดงานธุรการทุกครั้งที่มีคนใหม่เข้าทีม
 *
 * "ดูอย่างเดียว" เป็นประตูฝั่ง**เขียน** ไม่ใช่ฝั่งอ่าน — ไม่ต้องแตะ SELECT สักตัว
 * รายชื่อยกเว้นใช้ตารางเดียวกับที่ให้สิทธิ์แขก จึงได้สองฟีเจอร์จากตารางเดียว
 *
 * ═══ กฎข้อ 10 ═══
 * คอลัมน์ "ผลลัพธ์จริง" มาจากเซิร์ฟเวอร์ **หน้านี้ไม่คำนวณเอง**
 * เดิมหน้านี้เรียก `resolveAccess()` ฝั่งเบราว์เซอร์ ซึ่งดูเหมือนถูกกฎเพราะใช้ฟังก์ชันเดียวกัน
 * แต่ข้อมูลที่ป้อนเข้าไป (แถวยกเว้น · ใครเป็น PM) มาจากคนละที่กับที่ route ใช้จริง
 * วันหนึ่งจะไม่ตรงกัน แล้วตารางนี้จะโกหก — ให้เซิร์ฟเวอร์ตัดสินแล้วส่งผลมาที่เดียว
 */
type Access = 'none' | 'read' | 'write';

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  override: 'read' | 'write' | null;
  isPm: boolean;
  effective: Access;
  holding: string[];
}

interface View {
  projectId: string;
  key: string;
  name: string;
  memberAccess: 'collaborate' | 'read_only';
  pmUserId: string | null;
  isArchived: boolean;
  members: MemberRow[];
}

const LABEL: Record<Access, { text: string; cls: string }> = {
  write: { text: 'ร่วมงานได้', cls: 'st-done' },
  read: { text: 'ดูอย่างเดียว', cls: 'st-todo' },
  none: { text: 'ไม่เห็นโปรเจกต์นี้', cls: '' },
};

const ROLE_TH: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export default function AccessPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');

  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      setV(await api.get<View>(`/t/${tenant}/projects/${key}/members`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, key]);

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

  const setDefault = (memberAccess: 'collaborate' | 'read_only') =>
    run(async () => {
      setV(await api.patch<View>(`/t/${tenant}/projects/${key}/access`, { memberAccess }));
    });

  return (
    <>
      <PageHead title="สิทธิ์การเข้าถึง" desc={v ? `${v.name} · ${v.key}` : ''} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={false} />

      {err ? <div className="alert e">{err}</div> : null}
      {!v && !err ? (
        <Card>
          <div className="empty">กำลังโหลด…</div>
        </Card>
      ) : null}

      {v ? (
        <>
          <Card className="mb">
            <div className="card-h">
              <b>ค่าเริ่มต้นของโปรเจกต์นี้</b>
            </div>
            <div className="card-b">
              <label className="radrow">
                <input
                  type="radio"
                  name="acc"
                  checked={v.memberAccess === 'collaborate'}
                  disabled={busy}
                  onChange={() => void setDefault('collaborate')}
                />
                <span>
                  <b>ร่วมงานได้</b>
                  <br />
                  <span className="sub">สมาชิกทุกคนสร้างและแก้การ์ดในโปรเจกต์นี้ได้</span>
                </span>
              </label>
              <label className="radrow">
                <input
                  type="radio"
                  name="acc"
                  checked={v.memberAccess === 'read_only'}
                  disabled={busy}
                  onChange={() => void setDefault('read_only')}
                />
                <span>
                  <b>ดูอย่างเดียว</b>
                  <br />
                  <span className="sub">สมาชิกเห็นทุกอย่าง แต่แก้ไม่ได้ ยกเว้นคนในรายชื่อข้างล่าง</span>
                </span>
              </label>
            </div>
          </Card>

          <Card className="mb">
            <div className="card-h">
              <b>รายชื่อยกเว้น</b>
              <div className="r">
                <button
                  type="button"
                  className="btn btn-2 btn-sm"
                  onClick={() => setAdding((x) => !x)}
                >
                  ＋ เชิญคนนอก
                </button>
              </div>
            </div>
            {adding ? (
              <div className="card-b" style={{ display: 'flex', gap: 8 }}>
                <input
                  className="inp"
                  placeholder="อีเมลของคนนอกองค์กร"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-pri btn-sm"
                  disabled={busy || !email.trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.post(`/t/${tenant}/projects/${key}/members`, {
                        email,
                        access: 'read',
                      });
                      setEmail('');
                      setAdding(false);
                    })
                  }
                >
                  ส่งคำเชิญเป็นแขก
                </button>
              </div>
            ) : null}
            <table className="tbl">
              <thead>
                <tr>
                  <th>คน</th>
                  <th>บทบาทในที่ทำงาน</th>
                  <th>ผลลัพธ์จริง</th>
                  <th style={{ width: 220 }}>ตั้งยกเว้น</th>
                </tr>
              </thead>
              <tbody>
                {v.members.map((m) => {
                  const l = LABEL[m.effective];
                  return (
                    <tr key={m.userId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar
                            member={{
                              id: m.userId,
                              name: m.name,
                              initials: m.name.slice(0, 2),
                              email: m.email,
                              role: 'member',
                              jobTitle: 'other',
                              active: true,
                            }}
                            size="sm"
                          />
                          <span style={{ fontWeight: 500 }}>{m.name}</span>
                          {m.isPm ? <span className="chip st-review">PM</span> : null}
                          {m.override ? <span className="chip">ยกเว้นรายคน</span> : null}
                        </div>
                        {m.holding.length > 0 ? (
                          <div className="sub mn" style={{ fontSize: 11.5 }}>
                            ถืออยู่ {m.holding.join(' · ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="sub">{ROLE_TH[m.role] ?? m.role}</td>
                      <td>
                        <span className={`chip ${l.cls}`}>{l.text}</span>
                      </td>
                      <td>
                        {m.isPm ? (
                          <span className="hint">PM เขียนได้เสมอ ตั้งยกเว้นไม่มีผล</span>
                        ) : (
                          <select
                            className="inp"
                            aria-label={`สิทธิ์ของ ${m.name}`}
                            value={m.override ?? ''}
                            disabled={busy}
                            onChange={(e) => {
                              const val = e.target.value;
                              void run(async () => {
                                if (!val) {
                                  await api.del(`/t/${tenant}/projects/${key}/members/${m.userId}`);
                                } else if (m.override) {
                                  await api.patch(
                                    `/t/${tenant}/projects/${key}/members/${m.userId}`,
                                    { access: val },
                                  );
                                } else {
                                  await api.post(`/t/${tenant}/projects/${key}/members`, {
                                    userId: m.userId,
                                    access: val,
                                  });
                                }
                              });
                            }}
                          >
                            <option value="">ใช้ค่าเริ่มต้น</option>
                            <option value="read">ดูอย่างเดียว</option>
                            <option value="write">ร่วมงานได้</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <div className="alert i">
            <span>ℹ</span>
            <div>
              ผลลัพธ์ในตารางนี้คำนวณที่เซิร์ฟเวอร์ด้วยฟังก์ชันเดียวคือ <code>resolveAccess()</code> — ตัวเดียวกับที่ทุก
              route และทุกปุ่มในระบบใช้ ไม่มีที่ไหนตรวจสิทธิ์เอง รวมถึงหน้านี้ด้วย
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
