'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 12 · สร้างโปรเจกต์
 *
 * รหัสโปรเจกต์ (key) เปลี่ยนไม่ได้หลังสร้าง เพราะมันอยู่ในรหัสการ์ดทุกใบ (ACM-138)
 * และคนเอาไปอ้างกันในไลน์กับสแตนด์อัพแล้ว จึงเตือนไว้ตรงนี้ตั้งแต่ตอนกรอก
 *
 * ชื่อคอลัมน์ตั้งได้ 2–8 คอลัมน์ (กฎข้อ 8) — คอลัมน์มีแค่ชื่อกับลำดับ
 * ลำดับซ้ายไปขวาคือสิ่งที่มีความหมาย ไม่มีธงหรือการตั้งค่าใดๆ
 */
interface ClientRow {
  id: string;
  name: string;
}
interface Member {
  userId: string;
  name: string;
  jobTitle: string;
}
interface Template {
  id: string;
  name: string;
  isCentral: boolean;
  features: string[];
  taskCount: number;
  columns: string[];
}

const DEFAULT_COLUMNS = ['รอเริ่ม', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'];

function NewProjectInner() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();
  const preset = useSearchParams().get('template') ?? '';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(preset);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [pmUserId, setPmUserId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [dueOn, setDueOn] = useState('');
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ClientRow[]>(`/t/${tenant}/clients`),
      api.get<Member[]>(`/t/${tenant}/members`),
      api.get<Template[]>(`/t/${tenant}/templates`),
    ])
      .then(([cs, ms, tps]) => {
        setClients(cs);
        setMembers(ms);
        setTemplates(tps);
        if (cs[0]) setClientId(cs[0].id);
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant]);

  function setColumn(i: number, v: string) {
    setColumns((prev) => prev.map((c, idx) => (idx === i ? v : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const board = columns
        .map((c) => c.trim())
        .filter(Boolean)
        // คีย์คงที่ตามลำดับ ชื่อเปลี่ยนได้ — ลำดับคือสิ่งที่มีความหมาย
        .map((c, i) => ({ key: `c${i + 1}`, name: c }));
      const r = await api.post<{ key: string }>(`/t/${tenant}/projects`, {
        key,
        name,
        clientId,
        startsOn,
        dueOn,
        pmUserId: pmUserId || null,
        // เลือกแม่แบบแล้วบอร์ดมาจากแม่แบบ ไม่ใช่จากช่องที่กรอกไว้
        board: templateId ? undefined : board,
        templateId: templateId || undefined,
      });
      router.push(`/${tenant}/projects/${r.key}`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="โปรเจกต์ใหม่" desc="รหัสโปรเจกต์เปลี่ยนไม่ได้หลังสร้าง" />
      <form onSubmit={submit}>
        <Card className="mb">
          <div className="card-b">
            {err ? (
              <div className="alert d" style={{ marginBottom: 14 }}>
                <span>✕</span>
                <div>{err}</div>
              </div>
            ) : null}

            <div className="row2">
              <div className="fld">
                <span className="lbl">รหัสโปรเจกต์</span>
                <input
                  className="inp mn"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="ACM"
                  required
                />
                <div className="hint">อังกฤษ 2–5 ตัว · เปลี่ยนไม่ได้ เพราะอยู่ในรหัสการ์ดทุกใบ</div>
              </div>
              <div className="fld">
                <span className="lbl">ชื่อโปรเจกต์</span>
                <input
                  className="inp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ระบบสั่งซื้อออนไลน์"
                  required
                />
              </div>
            </div>

            <div className="row2">
              <div className="fld">
                <span className="lbl">ลูกค้า</span>
                <select
                  className="inp"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                >
                  {clients.length === 0 ? <option value="">— ยังไม่มีลูกค้า —</option> : null}
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <span className="lbl">PM</span>
                <select
                  className="inp"
                  value={pmUserId}
                  onChange={(e) => setPmUserId(e.target.value)}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <div className="hint">PM เป็นคนเดียวที่ปิดการ์ดได้</div>
              </div>
            </div>

            <div className="fld">
              <span className="lbl">แม่แบบ</span>
              <select
                className="inp"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">— ไม่ใช้แม่แบบ · บอร์ดเปล่า —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.isCentral ? '' : '★ '}
                    {t.name} · {t.taskCount} การ์ดตั้งต้น
                  </option>
                ))}
              </select>
              {templateId ? (
                <div className="hint">
                  แม่แบบจะกำหนดคอลัมน์ เฟส งานหลัก และการ์ดตั้งต้นให้ · แก้แม่แบบทีหลังไม่กระทบโปรเจกต์นี้
                </div>
              ) : null}
            </div>

            <div className="row2">
              <div className="fld">
                <span className="lbl">วันเริ่ม</span>
                <input
                  className="inp mn"
                  type="date"
                  value={startsOn}
                  onChange={(e) => setStartsOn(e.target.value)}
                  required
                />
              </div>
              <div className="fld">
                <span className="lbl">กำหนดส่ง</span>
                <input
                  className="inp mn"
                  type="date"
                  value={dueOn}
                  onChange={(e) => setDueOn(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="mb" style={templateId ? { display: 'none' } : undefined}>
          <div className="card-h">
            <b>คอลัมน์บนบอร์ด</b>
            <div className="r">
              <span className="chip">{columns.length} คอลัมน์</span>
            </div>
          </div>
          <div className="card-b">
            <div className="row4">
              {columns.map((c, i) => (
                <input
                  // ลำดับคือตัวระบุของคอลัมน์ ชื่อเปลี่ยนได้ตลอดจึงใช้เป็น key ไม่ได้
                  key={`col-${i + 1}`}
                  className="inp"
                  value={c}
                  onChange={(e) => setColumn(i, e.target.value)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn btn-2 btn-sm"
                onClick={() => setColumns((p) => [...p, `คอลัมน์ ${p.length + 1}`])}
                disabled={columns.length >= 8}
              >
                ＋ เพิ่มคอลัมน์
              </button>
              <button
                type="button"
                className="btn btn-2 btn-sm"
                onClick={() => setColumns((p) => p.slice(0, -1))}
                disabled={columns.length <= 2}
              >
                − เอาออก
              </button>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              ตั้งได้ 2–8 คอลัมน์ · คอลัมน์แรกคือที่ที่การ์ดใหม่มาลง · คอลัมน์สุดท้ายคือปิดงาน PM เท่านั้นที่ย้ายมาได้
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-pri" disabled={busy || clients.length === 0}>
            {busy ? 'กำลังสร้าง…' : 'สร้างโปรเจกต์'}
          </button>
          <Link href={`/${tenant}/projects`} className="btn btn-2">
            ยกเลิก
          </Link>
        </div>
      </form>
    </>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="hint">กำลังโหลด…</div>}>
      <NewProjectInner />
    </Suspense>
  );
}
