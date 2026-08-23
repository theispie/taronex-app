'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 41 · แก้ไขแม่แบบ
 *
 * ป้ายประเภทงานมีได้สูงสุด 3 ค่า เพราะช่องในฐานข้อมูลมีแค่ a/b/c
 * เป็นข้อจำกัดที่ตั้งใจ — ถ้าให้เพิ่มได้ไม่จำกัด แต่ละโปรเจกต์จะมีป้ายคนละชุด
 * แล้วรายงานข้ามโปรเจกต์จะเทียบกันไม่ได้
 *
 * แก้ที่นี่ **ไม่กระทบโปรเจกต์ที่สร้างไปแล้ว** เพราะตอนสร้างเราคัดลอกค่าออกไป
 */
interface Definition {
  board: { key: string; name: string }[];
  typeLabels: Record<string, string>;
  phases: { name: string; kind?: string }[];
  features: { name: string; tasks: { title: string }[] }[];
}
interface Template {
  id: string;
  name: string;
  description: string;
  isCentral: boolean;
  definition: Definition;
}

export default function EditTemplatePage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const id = String(p.id ?? '');
  const router = useRouter();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Template>(`/t/${tenant}/templates/${id}`)
      .then((t) => {
        setTpl(t);
        setName(t.name);
        setColumns(t.definition.board.map((c) => c.name));
        setTypes(Object.values(t.definition.typeLabels));
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tpl) return;
    setBusy(true);
    setErr(null);
    try {
      const board = columns
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c, i) => ({ key: `c${i + 1}`, name: c }));
      const slots = ['a', 'b', 'c'];
      const typeLabels = Object.fromEntries(
        types
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 3)
          .map((t, i) => [slots[i] as string, t]),
      );
      await api.patch(`/t/${tenant}/templates/${id}`, {
        name,
        definition: { ...tpl.definition, board, typeLabels },
      });
      router.push(`/${tenant}/templates`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  const taskCount = (tpl?.definition.features ?? []).reduce((n, f) => n + f.tasks.length, 0);

  return (
    <>
      <PageHead
        title={tpl ? `แก้ไข ${tpl.name}` : 'แก้ไขแม่แบบ'}
        desc={
          tpl ? `${tpl.definition.features.length} งานหลัก · ${taskCount} การ์ดตั้งต้น` : 'กำลังโหลด…'
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {tpl?.isCentral ? (
        <div className="alert w" style={{ marginBottom: 14 }}>
          <span>⚠</span>
          <div>แม่แบบสำเร็จรูปแก้ไม่ได้ — สร้างโปรเจกต์จากมันแล้วบันทึกกลับมาเป็นแม่แบบของทีมแทน</div>
        </div>
      ) : null}

      {tpl ? (
        <form onSubmit={save}>
          <Card className="mb">
            <div className="card-b">
              <div className="fld">
                <span className="lbl">ชื่อแม่แบบ</span>
                <input
                  className="inp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={tpl.isCentral}
                  required
                />
              </div>
            </div>
          </Card>

          <Card className="mb">
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
                    key={`col-${i + 1}`}
                    className="inp"
                    value={c}
                    disabled={tpl.isCentral}
                    onChange={(e) =>
                      setColumns((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                  />
                ))}
              </div>
              {tpl.isCentral ? null : (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btn-2 btn-sm"
                    disabled={columns.length >= 8}
                    onClick={() => setColumns((p2) => [...p2, `คอลัมน์ ${p2.length + 1}`])}
                  >
                    ＋ เพิ่มคอลัมน์
                  </button>
                  <button
                    type="button"
                    className="btn btn-2 btn-sm"
                    disabled={columns.length <= 2}
                    onClick={() => setColumns((p2) => p2.slice(0, -1))}
                  >
                    − เอาออก
                  </button>
                </div>
              )}
              <div className="hint" style={{ marginTop: 10 }}>
                ตั้งได้ 2–8 คอลัมน์ · ลำดับซ้ายไปขวาคือสิ่งที่มีความหมาย
              </div>
            </div>
          </Card>

          <Card className="mb">
            <div className="card-h">
              <b>ป้ายประเภทงาน</b>
              <div className="r">
                <span className="chip">สูงสุด 3</span>
              </div>
            </div>
            <div className="card-b">
              <div className="row3">
                {[0, 1, 2].map((i) => (
                  <input
                    key={`type-${i}`}
                    className="inp"
                    value={types[i] ?? ''}
                    disabled={tpl.isCentral}
                    placeholder={i === 0 ? 'งาน' : 'ไม่บังคับ'}
                    onChange={(e) =>
                      setTypes((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                  />
                ))}
              </div>
              <div className="hint" style={{ marginTop: 10 }}>
                สูงสุด 3 ค่า — คำว่า “บั๊ก” ใช้ไม่ได้กับงาน HR หรือการตลาด จึงให้ตั้งเอง
              </div>
            </div>
          </Card>

          <Card className="mb">
            <div className="card-h">
              <b>งานหลักและการ์ดตั้งต้น</b>
            </div>
            <div className="card-b">
              {tpl.definition.features.length === 0 ? (
                <div className="empty">แม่แบบนี้ไม่มีงานหลักตั้งต้น</div>
              ) : (
                tpl.definition.features.map((f) => (
                  <div className="row" key={f.name}>
                    <span className="row-title">{f.name}</span>
                    <span className="sub mn">{f.tasks.length} การ์ด</span>
                  </div>
                ))
              )}
              <div className="hint" style={{ marginTop: 8 }}>
                แก้งานหลักและการ์ดตั้งต้นยังทำที่นี่ไม่ได้ในเวอร์ชันนี้ — ปรับในโปรเจกต์แล้วบันทึกกลับมาเป็นแม่แบบใหม่แทน
              </div>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-pri" disabled={busy || tpl.isCentral}>
              {busy ? 'กำลังบันทึก…' : 'บันทึกแม่แบบ'}
            </button>
            <Link href={`/${tenant}/templates`} className="btn btn-2">
              ยกเลิก
            </Link>
          </div>

          <div className="alert i" style={{ marginTop: 14 }}>
            <span>ℹ</span>
            <div>แก้ที่นี่ไม่กระทบโปรเจกต์ที่สร้างจากแม่แบบนี้ไปแล้ว</div>
          </div>
        </form>
      ) : !err ? (
        <div className="hint">กำลังโหลด…</div>
      ) : null}
    </>
  );
}
