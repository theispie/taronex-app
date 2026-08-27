'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/api-client';
import type { BoardMember } from './types';

/**
 * ⭐ ลิ้นชักการ์ด — แก้ได้ครบทุกอย่างโดยไม่ต้องเปิดหน้าเต็ม
 *
 * ═══ ทำไมบันทึกอัตโนมัติ ไม่มีปุ่มบันทึก ═══
 * ลิ้นชักเปิดจากบอร์ดเพื่อแก้ของเล็กๆ เร็วๆ — เปลี่ยนคนรับผิดชอบ เลื่อนกำหนดส่ง
 * ถ้ามีปุ่มบันทึก คนจะปิดลิ้นชักโดยลืมกดแล้วของหาย ซึ่งแย่กว่าการเซฟบ่อยเกินไปมาก
 * ยิงหลังหยุดพิมพ์ 700ms · ยิงเฉพาะฟิลด์ที่เปลี่ยนจริง
 *
 * ═══ คอลัมน์แก้ที่นี่ไม่ได้ ═══
 * `column_key` ขยับได้ทางเดียวคือ POST /tasks/:id/transition (กฎข้อ 4)
 * ในลิ้นชักจึงแสดงอย่างเดียว ย้ายคอลัมน์ต้องลากการ์ดบนบอร์ด
 */

interface FullTask {
  id: string;
  projectKey: string;
  number: number;
  title: string;
  description: string | null;
  columnKey: string;
  board: { key: string; name: string }[];
  typeLabels: Record<string, string>;
  typeSlot: string;
  priority: string;
  featureId: string | null;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  isClientVisible: boolean;
  comments: {
    id: string;
    body: string;
    isSystem: boolean;
    createdAt: string;
    authorName: string | null;
  }[];
  history: {
    id: string;
    at: string;
    fromColumnName: string | null;
    toColumnName: string | null;
    reason: string | null;
    actorName: string | null;
  }[];
  yourAccess: 'none' | 'read' | 'write';
}

/** ฟิลด์ที่แก้ได้ในลิ้นชัก · คอลัมน์ไม่อยู่ในนี้โดยตั้งใจ */
type Draft = Pick<
  FullTask,
  | 'title'
  | 'description'
  | 'typeSlot'
  | 'priority'
  | 'featureId'
  | 'assigneeId'
  | 'startDate'
  | 'dueDate'
  | 'isClientVisible'
>;

const PRIORITIES: { v: string; label: string }[] = [
  { v: 'low', label: 'ต่ำ' },
  { v: 'medium', label: 'ปกติ' },
  { v: 'high', label: 'สูง' },
  { v: 'critical', label: 'ด่วนมาก' },
];

function draftOf(t: FullTask): Draft {
  return {
    title: t.title,
    description: t.description,
    typeSlot: t.typeSlot,
    priority: t.priority,
    featureId: t.featureId,
    assigneeId: t.assigneeId,
    startDate: t.startDate,
    dueDate: t.dueDate,
    isClientVisible: t.isClientVisible,
  };
}

export function CardDrawer({
  tenant,
  taskId,
  code,
  features,
  members,
  onClose,
  onSaved,
}: {
  tenant: string;
  taskId: string;
  code: string;
  features: { id: string; name: string }[];
  members: BoardMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [task, setTask] = useState<FullTask | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  /** ค่าที่เซิร์ฟเวอร์รับไปแล้ว — ใช้เทียบว่าอะไรเปลี่ยนจริง */
  const savedRef = useRef<Draft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await api.get<FullTask>(`/t/${tenant}/tasks/${taskId}`);
      setTask(t);
      setDraft(draftOf(t));
      savedRef.current = draftOf(t);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** ยิงเฉพาะฟิลด์ที่ต่างจากค่าที่เซิร์ฟเวอร์รับไปแล้ว */
  const flush = useCallback(
    async (next: Draft) => {
      const base = savedRef.current;
      if (!base) return;
      const patch: Record<string, unknown> = {};
      for (const k of Object.keys(next) as (keyof Draft)[]) {
        if (next[k] !== base[k]) patch[k] = next[k];
      }
      if (Object.keys(patch).length === 0) return;

      setState('saving');
      try {
        await api.patch(`/t/${tenant}/tasks/${taskId}`, patch);
        savedRef.current = next;
        setState('saved');
        onSaved();
      } catch (e) {
        setState('error');
        setErr(errorText(e));
      }
    },
    [tenant, taskId, onSaved],
  );

  function edit(patch: Partial<Draft>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(next), 700);
      return next;
    });
  }

  // ปิดลิ้นชักตอนยังมีของค้างไม่ได้ยิง — ยิงทิ้งท้ายให้ก่อน
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function addComment() {
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    try {
      await api.post(`/t/${tenant}/tasks/${taskId}/comments`, { body });
      setComment('');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSending(false);
    }
  }

  const readOnly = task?.yourAccess !== 'write';
  const columnName = task?.board.find((c) => c.key === task.columnKey)?.name ?? '';

  return (
    /**
     * กดที่ฉากหลังแล้วปิด — เช็ค `e.target === e.currentTarget` เพื่อให้ปิดเฉพาะตอน
     * กดโดนฉากหลังจริงๆ กดในกรอบแล้ว event ลอยขึ้นมาถึงตรงนี้ก็ไม่นับ
     *
     * ห้ามใช้ <button> ห่อ — ข้างในมี <input> กับ <select> ซึ่งเป็น interactive content
     * ที่ HTML ห้ามอยู่ใน <button> แล้วเบราว์เซอร์จะทำตัวแปลกๆ กับฟอร์มทั้งชุด
     * ทางเข้าถึงด้วยคีย์บอร์ดใช้ Escape ซึ่งหน้าบอร์ดจัดการไว้แล้ว
     */
    // biome-ignore lint/a11y/noStaticElementInteractions: ปิดด้วย Escape มีอยู่แล้วที่หน้าบอร์ด
    <div
      className="ovl"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ovl-card">
        <div className="pw-top">
          <b className="mn">{code}</b>
          <span className="sub" style={{ marginLeft: 8 }}>
            {state === 'saving' ? 'กำลังบันทึก…' : state === 'saved' ? 'บันทึกแล้ว' : ''}
          </span>
          <span style={{ flex: 1 }} />
          {task ? (
            <Link href={`/${tenant}/tickets/${code}`} className="btn btn-sm btn-2">
              เปิดหน้าเต็ม
            </Link>
          ) : null}
          <button type="button" className="btn btn-sm btn-gh" onClick={onClose}>
            ปิด
          </button>
        </div>

        <div className="pw-in">
          {err ? (
            <div className="hint" style={{ color: 'var(--danger)', marginBottom: 10 }}>
              {err}
            </div>
          ) : null}

          {!task || !draft ? (
            <div className="hint">กำลังโหลด…</div>
          ) : (
            <>
              <div className="fld">
                <span className="lbl">ชื่อการ์ด</span>
                <input
                  className="inp"
                  value={draft.title}
                  disabled={readOnly}
                  onChange={(e) => edit({ title: e.target.value })}
                />
              </div>

              <div className="fld">
                <span className="lbl">รายละเอียด</span>
                <textarea
                  className="inp"
                  rows={4}
                  value={draft.description ?? ''}
                  disabled={readOnly}
                  placeholder="อธิบายให้คนที่รับงานต่อเข้าใจได้โดยไม่ต้องถาม"
                  onChange={(e) => edit({ description: e.target.value })}
                />
              </div>

              <div className="row2">
                <div className="fld">
                  <span className="lbl">ผู้รับผิดชอบ</span>
                  <select
                    className="inp"
                    value={draft.assigneeId ?? ''}
                    disabled={readOnly}
                    onChange={(e) => edit({ assigneeId: e.target.value || null })}
                  >
                    <option value="">ยังไม่มีเจ้าของ</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fld">
                  <span className="lbl">ความสำคัญ</span>
                  <select
                    className="inp"
                    value={draft.priority}
                    disabled={readOnly}
                    onChange={(e) => edit({ priority: e.target.value })}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.v} value={p.v}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row2">
                <div className="fld">
                  <span className="lbl">งานหลัก</span>
                  <select
                    className="inp"
                    value={draft.featureId ?? ''}
                    disabled={readOnly}
                    onChange={(e) => edit({ featureId: e.target.value || null })}
                  >
                    <option value="">งานนอกแผน</option>
                    {features.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="fld">
                  <span className="lbl">ประเภท</span>
                  <select
                    className="inp"
                    value={draft.typeSlot}
                    disabled={readOnly}
                    onChange={(e) => edit({ typeSlot: e.target.value })}
                  >
                    {(['a', 'b', 'c'] as const).map((slot) => (
                      <option key={slot} value={slot}>
                        {task.typeLabels[slot] ?? slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row2">
                <div className="fld">
                  <span className="lbl">วันเริ่ม</span>
                  <input
                    className="inp mn"
                    type="date"
                    value={draft.startDate ?? ''}
                    disabled={readOnly}
                    onChange={(e) => edit({ startDate: e.target.value || null })}
                  />
                </div>
                <div className="fld">
                  <span className="lbl">กำหนดส่ง</span>
                  <input
                    className="inp mn"
                    type="date"
                    value={draft.dueDate ?? ''}
                    disabled={readOnly}
                    onChange={(e) => edit({ dueDate: e.target.value || null })}
                  />
                </div>
              </div>

              <div className="kv">
                <span>คอลัมน์</span>
                <b>{columnName}</b>
              </div>
              <div className="hint" style={{ marginTop: -4, marginBottom: 10 }}>
                ย้ายคอลัมน์ทำได้ด้วยการลากการ์ดบนบอร์ดเท่านั้น
              </div>

              <label className="fld" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={draft.isClientVisible}
                  disabled={readOnly}
                  onChange={(e) => edit({ isClientVisible: e.target.checked })}
                />
                <span className="lbl" style={{ margin: 0 }}>
                  ลูกค้าเห็นการ์ดใบนี้ในพอร์ทัล
                </span>
              </label>

              <div className="card-h" style={{ marginTop: 16 }}>
                <b>คอมเมนต์</b>
              </div>
              {task.comments.length === 0 ? (
                <div className="hint">ยังไม่มีคอมเมนต์</div>
              ) : (
                task.comments.map((c) => (
                  <div key={c.id} className="row" style={{ display: 'block', padding: '6px 0' }}>
                    <span className="sub">
                      {c.isSystem ? 'ระบบ' : (c.authorName ?? 'ไม่ทราบชื่อ')} ·{' '}
                      {c.createdAt.slice(0, 16).replace('T', ' ')}
                    </span>
                    <div>{c.body}</div>
                  </div>
                ))
              )}
              {readOnly ? null : (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    className="inp"
                    value={comment}
                    placeholder="พิมพ์ @อีเมล เพื่อเรียกใครสักคน"
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-pri"
                    disabled={sending || !comment.trim()}
                    onClick={() => void addComment()}
                  >
                    ส่ง
                  </button>
                </div>
              )}

              <div className="card-h" style={{ marginTop: 16 }}>
                <b>ประวัติ</b>
              </div>
              {task.history.length === 0 ? (
                <div className="hint">ยังไม่มีการเคลื่อนไหว</div>
              ) : (
                task.history.map((h) => (
                  <div key={h.id} className="row" style={{ display: 'block', padding: '5px 0' }}>
                    <span className="sub mn">{h.at.slice(0, 16).replace('T', ' ')}</span>{' '}
                    <span>
                      {h.fromColumnName ? `${h.fromColumnName} → ` : ''}
                      {h.toColumnName ?? ''}
                    </span>{' '}
                    <span className="sub">{h.actorName ?? ''}</span>
                    {h.reason ? <div className="sub">เหตุผล: {h.reason}</div> : null}
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
