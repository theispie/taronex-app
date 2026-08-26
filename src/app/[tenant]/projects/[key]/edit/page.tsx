'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 12 · แก้ไขโปรเจกต์
 *
 * รหัสย่อเปลี่ยนภายหลังไม่ได้ เพราะรหัสการ์ดเก่า (ACM-138) จะกำพร้า
 * คอลัมน์แก้ที่นี่ได้ แต่แก้แล้วกระทบเฉพาะโปรเจกต์นี้ ไม่ย้อนไปที่แม่แบบ
 *
 * ═══ กฎข้อ 7 · ปุ่ม "ปิดโปรเจกต์" ไม่ใช่ปุ่มลบ ═══
 * ปิดแล้วคืนโควตาทันทีโดยไม่ลบอะไรเลย และเปิดคืนได้ตลอด
 * ทั้งระบบไม่มีเส้นทางลบโปรเจกต์เลยแม้แต่เส้นเดียว — ตั้งใจให้เป็นแบบนั้น
 */
interface Client {
  id: string;
  name: string;
}
interface Member {
  userId: string;
  name: string;
  role: string;
}
interface Project {
  id: string;
  key: string;
  name: string;
  clientId: string;
  pmUserId: string | null;
  board: { key: string; name: string }[];
  typeLabels: Record<string, string>;
  startsOn: string;
  dueOn: string | null;
  isArchived: boolean;
}

export default function EditProjectPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const router = useRouter();

  const [proj, setProj] = useState<Project | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [pmUserId, setPmUserId] = useState('');
  const [board, setBoard] = useState<{ key: string; name: string }[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});

  const apply = useCallback((d: Project) => {
    setProj(d);
    setName(d.name);
    setPmUserId(d.pmUserId ?? '');
    setBoard(d.board);
    setTypes(d.typeLabels);
  }, []);

  const load = useCallback(async () => {
    try {
      const [d, cs, ms] = await Promise.all([
        api.get<Project>(`/t/${tenant}/projects/${key}`),
        api.get<Client[]>(`/t/${tenant}/clients`),
        api.get<Member[]>(`/t/${tenant}/members`),
      ]);
      apply(d);
      setClients(cs);
      setMembers(ms.filter((m) => m.role !== 'guest' && m.role !== 'viewer'));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, key, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      await api.patch(`/t/${tenant}/projects/${key}`, {
        name,
        pmUserId: pmUserId || null,
        board,
        typeLabels: types,
      });
      setSaved(true);
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ isArchived: boolean; openProjects: number; limit: number }>(
        `/t/${tenant}/projects/${key}/archive`,
        { archived: !proj?.isArchived },
      );
      if (r.isArchived) router.push(`/${tenant}/projects`);
      else await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const clientName = clients.find((c) => c.id === proj?.clientId)?.name ?? '';

  return (
    <>
      <PageHead title="แก้ไขโปรเจกต์" desc={proj ? `${proj.key} · ${proj.name}` : ''} />
      <div style={{ maxWidth: 640 }}>
        {err ? <div className="alert e">{err}</div> : null}
        {saved ? <div className="alert s">บันทึกแล้ว</div> : null}
        {proj?.isArchived ? (
          <div className="alert w">
            <span>⚠</span>
            <div>โปรเจกต์นี้ปิดอยู่ · ข้อมูลยังอยู่ครบ แก้ไม่ได้จนกว่าจะเปิดคืน</div>
          </div>
        ) : null}

        {proj ? (
          <>
            <Card className="mb">
              <div className="card-b">
                <div className="fld">
                  <label className="lbl" htmlFor="pn">
                    ชื่อโปรเจกต์
                  </label>
                  <input
                    id="pn"
                    className="inp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="row2">
                  <div className="fld">
                    <label className="lbl" htmlFor="pk">
                      รหัสย่อ
                    </label>
                    <input
                      id="pk"
                      className="inp mn"
                      value={proj.key}
                      readOnly
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    />
                    <div className="hint">เปลี่ยนไม่ได้ เพราะรหัสการ์ดเก่า ({proj.key}-1) จะกำพร้า</div>
                  </div>
                  <div className="fld">
                    <label className="lbl" htmlFor="pc">
                      ลูกค้า
                    </label>
                    <input
                      id="pc"
                      className="inp"
                      value={clientName}
                      readOnly
                      style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
                    />
                    <div className="hint">ย้ายลูกค้าไม่ได้ เพราะสัญญาประกันผูกกับลูกค้ารายนี้</div>
                  </div>
                </div>

                <div className="fld" style={{ marginBottom: 0 }}>
                  <label className="lbl" htmlFor="pm">
                    PM ของโปรเจกต์
                  </label>
                  <select
                    id="pm"
                    className="inp"
                    value={pmUserId}
                    onChange={(e) => setPmUserId(e.target.value)}
                  >
                    <option value="">ยังไม่กำหนด</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <div className="hint">PM เป็นคนเดียวที่ย้ายการ์ดเข้าคอลัมน์สุดท้ายได้</div>
                </div>
              </div>
            </Card>

            <Card className="mb">
              <div className="card-h">
                <b>คอลัมน์บนบอร์ด</b>
                <div className="r">
                  <span className="sub">{board.length} คอลัมน์</span>
                  <button
                    type="button"
                    className="btn btn-2 btn-sm"
                    disabled={board.length >= 8}
                    onClick={() =>
                      setBoard((b) => [
                        ...b,
                        { key: `c${Date.now().toString(36)}`, name: 'คอลัมน์ใหม่' },
                      ])
                    }
                  >
                    ＋ เพิ่มคอลัมน์
                  </button>
                </div>
              </div>
              <div className="card-b">
                {board.map((c, i) => (
                  <div key={c.key} className="colrow2">
                    <span style={{ color: 'var(--faint)' }}>{i + 1}</span>
                    <span />
                    <input
                      className="inp"
                      aria-label={`ชื่อคอลัมน์ที่ ${i + 1}`}
                      value={c.name}
                      onChange={(e) =>
                        setBoard((b) =>
                          b.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-gh"
                      disabled={board.length <= 2}
                      onClick={() => setBoard((b) => b.filter((x) => x.key !== c.key))}
                    >
                      ลบ
                    </button>
                  </div>
                ))}
                <div className="alert w" style={{ marginTop: 12 }}>
                  <span>⚠</span>
                  <div>ลบคอลัมน์ที่ยังมีการ์ดอยู่ไม่ได้ — เซิร์ฟเวอร์จะปฏิเสธตอนบันทึก และบอกว่าติดคอลัมน์ไหน</div>
                </div>
              </div>
            </Card>

            <Card className="mb">
              <div className="card-b">
                <div className="fld" style={{ marginBottom: 0 }}>
                  <span className="lbl">ชื่อประเภทงาน</span>
                  <div className="row3">
                    {Object.entries(types).map(([slot, label]) => (
                      <input
                        key={slot}
                        className="inp"
                        aria-label={`ชื่อประเภทงานช่อง ${slot}`}
                        value={label}
                        onChange={(e) => setTypes((t) => ({ ...t, [slot]: e.target.value }))}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-pri"
                disabled={busy || proj.isArchived}
                onClick={() => void save()}
              >
                บันทึก
              </button>
              <Link href={`/${tenant}/projects/${key}`} className="btn btn-2">
                ยกเลิก
              </Link>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className={proj.isArchived ? 'btn btn-2' : 'btn btn-dn'}
                disabled={busy}
                onClick={() => void toggleArchive()}
              >
                {proj.isArchived ? 'เปิดโปรเจกต์คืน' : 'ปิดโปรเจกต์'}
              </button>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              ปิดโปรเจกต์ = <code>is_archived</code> <b>ไม่ลบข้อมูล</b> และคืนโควตาทันที ·
              เปิดคืนได้ตลอดถ้าโควตายังว่าง
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
