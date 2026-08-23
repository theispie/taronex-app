'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 20 · รายละเอียดทิกเก็ต
 *
 * ═══ ปุ่มย้ายคอลัมน์คือหัวใจของหน้านี้ ═══
 * ไม่มีช่อง "สถานะ" ให้เลือกจากรายการ เพราะการ์ดขยับได้ทางเดียวคือ transition
 * และกติกาขึ้นกับ **ทิศทาง** ที่ย้าย ไม่ใช่ชื่อคอลัมน์ปลายทาง
 *   ถอยหลัง → กล่องเหตุผลโผล่มาบังคับ และการ์ดจะกลับไปหาเจ้าของคนก่อน
 *   คอลัมน์สุดท้าย → เฉพาะ PM เท่านั้นที่กดได้ คนอื่นเห็นปุ่มเป็นสีจาง
 */
interface HistoryRow {
  id: string;
  at: string;
  fromColumnName: string | null;
  toColumnName: string | null;
  fromColumnIndex: number | null;
  toColumnIndex: number | null;
  reason: string | null;
  actorName: string | null;
}
interface CommentRow {
  id: string;
  body: string;
  isInternal: boolean;
  isSystem: boolean;
  createdAt: string;
  authorName: string | null;
}
interface Task {
  id: string;
  code: string;
  title: string;
  description: string | null;
  columnKey: string;
  columnName: string;
  columnIndex: number;
  columnCount: number;
  isClosed: boolean;
  priority: string;
  assigneeName: string | null;
  featureName: string | null;
  dueDate: string | null;
  eta: string | null;
  board: { key: string; name: string }[];
  comments: CommentRow[];
  history: HistoryRow[];
  yourAccess: string;
  youArePm: boolean;
}

export default function TicketPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const code = String(p.code ?? '');
  const [task, setTask] = useState<Task | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ key: string; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');

  /** หา id จากรหัส (ACM-138) — หน้าเว็บใช้รหัส ส่วน API ใช้ id */
  const load = useCallback(async () => {
    try {
      const [projectKey, numStr] = code.split('-');
      const list = await api.get<{ id: string; number: number }[]>(
        `/t/${tenant}/projects/${projectKey}/tasks`,
      );
      const found = list.find((t) => String(t.number) === numStr);
      if (!found) throw new Error(`ไม่พบการ์ด ${code}`);
      setTask(await api.get<Task>(`/t/${tenant}/tasks/${found.id}`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, code]);

  useEffect(() => {
    void load();
  }, [load]);

  function clickColumn(col: { key: string; name: string }, index: number) {
    if (!task) return;
    setErr(null);
    // ถอยหลัง = ตีกลับ ต้องถามเหตุผลก่อน ไม่ใช่ย้ายไปเลยแล้วค่อยถาม
    if (index < task.columnIndex) {
      setPending(col);
      setReason('');
      return;
    }
    void doMove(col.key);
  }

  async function doMove(toColumnKey: string, withReason?: string) {
    if (!task) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/tasks/${task.id}/transition`, {
        toColumnKey,
        reason: withReason,
      });
      setPending(null);
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    try {
      await api.post(`/t/${tenant}/tasks/${task.id}/comments`, { body: comment });
      setComment('');
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  const canWrite = task?.yourAccess === 'write';

  return (
    <>
      <PageHead
        title={task ? `${task.code} · ${task.title}` : code}
        desc={task ? `${task.featureName ?? 'งานนอกแผน'} · ${task.columnName}` : 'กำลังโหลด…'}
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {task ? (
        <>
          {/* ═══ ย้ายคอลัมน์ ═══ */}
          <Card className="mb">
            <div className="card-h">
              <b>ย้ายการ์ด</b>
              <div className="r">
                <span className={`chip ${task.isClosed ? 'st-done' : 'st-doing'}`}>
                  {task.columnName}
                </span>
              </div>
            </div>
            <div className="card-b">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {task.board.map((col, i) => {
                  const isNow = col.key === task.columnKey;
                  const isLast = i === task.columnCount - 1;
                  const blockedByPm = isLast && !task.youArePm;
                  return (
                    <button
                      key={col.key}
                      type="button"
                      className={`btn btn-sm ${isNow ? 'btn-pri' : 'btn-2'}${blockedByPm ? ' dis' : ''}`}
                      disabled={isNow || busy || !canWrite || blockedByPm}
                      title={blockedByPm ? 'ปิดงานได้เฉพาะ PM ของโปรเจกต์' : undefined}
                      onClick={() => clickColumn(col, i)}
                    >
                      {i < task.columnIndex ? '← ' : ''}
                      {col.name}
                    </button>
                  );
                })}
              </div>

              {pending ? (
                <div className="alert w" style={{ marginTop: 12 }}>
                  <span>⚠</span>
                  <div style={{ width: '100%' }}>
                    <b>ตีกลับไป “{pending.name}”</b>
                    <div className="sub" style={{ margin: '4px 0 8px' }}>
                      การ์ดจะกลับไปหาเจ้าของคนก่อน — เขาต้องรู้ว่าต้องแก้อะไร
                    </div>
                    <input
                      className="inp"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="เช่น ส่วนลดซ้อนกันยังคำนวณผิดตอนใส่คูปองสองใบ"
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-dn"
                        disabled={busy || !reason.trim()}
                        onClick={() => doMove(pending.key, reason)}
                      >
                        ตีกลับ
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-2"
                        onClick={() => setPending(null)}
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="hint" style={{ marginTop: 10 }}>
                คอลัมน์สุดท้ายคือปิดงาน · PM เท่านั้นที่ย้ายมาได้ · ลากถอยหลังคือตีกลับ ต้องใส่เหตุผลเสมอ
              </div>
            </div>
          </Card>

          <div className="tk-grid">
            <div>
              <Card className="mb">
                <div className="card-h">
                  <b>รายละเอียด</b>
                </div>
                <div className="card-b">
                  <p className="sub">{task.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                  <div className="kv">
                    <span>ผู้รับผิดชอบ</span>
                    <b>{task.assigneeName ?? 'ยังไม่มี'}</b>
                  </div>
                  <div className="kv">
                    <span>ความเร่งด่วน</span>
                    <b>{task.priority}</b>
                  </div>
                  <div className="kv">
                    <span>กำหนดส่ง</span>
                    <b className="mn">{task.dueDate ?? '—'}</b>
                  </div>
                  <div className="kv">
                    <span>จะเสร็จเมื่อไร</span>
                    <b>{task.eta ?? 'ยังไม่ได้ตอบ'}</b>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="card-h">
                  <b>คอมเมนต์</b>
                  <div className="r">
                    <span className="chip">ลูกค้าไม่เห็น</span>
                  </div>
                </div>
                <div className="card-b">
                  {task.comments.length === 0 ? (
                    <div className="empty">ยังไม่มีคอมเมนต์</div>
                  ) : (
                    task.comments.map((c) =>
                      c.isSystem ? (
                        <div className="sysline" key={c.id}>
                          {c.body}
                        </div>
                      ) : (
                        <div
                          className={`cmt${c.body.startsWith('ตีกลับ') ? ' cmt-reject' : ''}`}
                          key={c.id}
                        >
                          <div className="cmt-h">
                            <b>{c.authorName ?? 'ไม่ทราบ'}</b>
                            <span className="sub mn">
                              {new Date(c.createdAt).toLocaleString('th-TH')}
                            </span>
                          </div>
                          <div>{c.body}</div>
                        </div>
                      ),
                    )
                  )}
                  {canWrite ? (
                    <form onSubmit={addComment} style={{ marginTop: 12 }}>
                      <input
                        className="inp"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="เขียนคอมเมนต์…"
                        required
                      />
                      <button type="submit" className="btn btn-pri btn-sm" style={{ marginTop: 8 }}>
                        ส่ง
                      </button>
                    </form>
                  ) : null}
                </div>
              </Card>
            </div>

            <Card>
              <div className="card-h">
                <b>ประวัติ</b>
                <div className="r">
                  <span className="chip">แก้ย้อนหลังไม่ได้</span>
                </div>
              </div>
              <div className="card-b">
                {task.history.map((h) => {
                  const bounced =
                    h.fromColumnIndex !== null &&
                    h.toColumnIndex !== null &&
                    h.toColumnIndex < h.fromColumnIndex;
                  return (
                    <div className="row" key={h.id} style={{ alignItems: 'flex-start' }}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block' }}>
                          {h.fromColumnName ? `${h.fromColumnName} → ` : 'สร้างที่ '}
                          <b>{h.toColumnName}</b>
                          {bounced ? <span className="tag late"> ตีกลับ</span> : null}
                        </span>
                        {h.reason ? (
                          <span className="sub" style={{ display: 'block' }}>
                            {h.reason}
                          </span>
                        ) : null}
                        <span className="sub mn" style={{ fontSize: 11 }}>
                          {h.actorName ?? '—'} · {new Date(h.at).toLocaleString('th-TH')}
                        </span>
                      </span>
                    </div>
                  );
                })}
                <div className="hint" style={{ marginTop: 8 }}>
                  ทุกตัวเลขในระบบ — ถือมากี่วัน ธงเตือน สถิติตีกลับ — มาจากตารางนี้
                </div>
              </div>
            </Card>
          </div>

          <p className="auth-link" style={{ marginTop: 14 }}>
            <Link href={`/${tenant}/projects`}>กลับไปรายการโปรเจกต์</Link>
          </p>
        </>
      ) : !err ? (
        <div className="hint">กำลังโหลด…</div>
      ) : null}
    </>
  );
}
