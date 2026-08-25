'use client';

import { useMemo, useState } from 'react';
import type { LiveTable } from '@/lib/db/live';
import type { TableInfo } from '@/lib/db/schema-map';

/**
 * ตารางทั้งหมดพร้อมฟิลด์ — ค้นหาได้ทั้งชื่อตารางและชื่อคอลัมน์
 *
 * ค้นด้วย `includes` ตัวพิมพ์เล็ก ไม่ใช่ full-text
 * เพราะคนหาคำว่า "portal" แล้วต้องเจอ `portal_stage` ด้วย
 */
interface Props {
  tables: TableInfo[];
  live: Record<string, LiveTable>;
}

const TYPE_TONE: Record<string, string> = {
  uuid: 'var(--muted)',
  text: 'var(--ink-2)',
  integer: 'var(--ok)',
  boolean: 'var(--warn)',
  jsonb: 'var(--danger)',
};

function toneOf(type: string): string {
  if (type.startsWith('timestamp')) return 'var(--ws-700)';
  return TYPE_TONE[type] ?? 'var(--ink-2)';
}

export function TableList({ tables, live }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return tables;
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.group.toLowerCase().includes(needle) ||
        t.columns.some((c) => c.name.toLowerCase().includes(needle)),
    );
  }, [tables, q]);

  let lastGroup = '';

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b">
          <input
            className="inp mn"
            placeholder="ค้นชื่อตารางหรือชื่อฟิลด์ เช่น portal_stage · sla · tenant_id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="hint" style={{ marginTop: 6 }}>
            แสดง {shown.length} จาก {tables.length} ตาราง · กดที่ชื่อตารางเพื่อดูฟิลด์ทั้งหมด
          </div>
        </div>
      </div>

      {shown.map((t) => {
        const l = live[t.name];
        const isOpen = open === t.name || q.trim().length > 0;
        const header = t.group !== lastGroup ? t.group : null;
        lastGroup = t.group;

        return (
          <div key={t.name}>
            {header ? (
              <div
                className="sub"
                style={{ margin: '18px 0 8px', fontWeight: 600, letterSpacing: '.02em' }}
              >
                {header}
              </div>
            ) : null}

            <div className="card" style={{ marginBottom: 8 }}>
              <button
                type="button"
                className="card-h"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                }}
                onClick={() => setOpen(open === t.name ? null : t.name)}
              >
                <b className="mn">{t.name}</b>
                <span className="sub">{t.columns.length} ฟิลด์</span>
                <div className="r">
                  {!t.hasTenantId ? (
                    <span className="chip" title="ไม่มี tenant_id จึงไม่มี RLS">
                      ไม่มี RLS
                    </span>
                  ) : l?.rlsForced ? (
                    <span className="chip st-done">RLS + FORCE</span>
                  ) : l?.rlsEnabled ? (
                    <span className="chip st-doing">RLS ไม่ FORCE</span>
                  ) : (
                    <span className="chip st-blocked">ยังไม่เปิด RLS</span>
                  )}
                  {l ? <span className="sub mn">~{l.approxRows} แถว</span> : null}
                </div>
              </button>

              {t.note ? (
                <div className="card-b" style={{ paddingTop: 0 }}>
                  <div className="hint">{t.note}</div>
                </div>
              ) : null}

              {isOpen ? (
                <>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 200 }}>ฟิลด์</th>
                        <th style={{ width: 150 }}>ชนิด</th>
                        <th style={{ width: 90 }}>ว่างได้</th>
                        <th style={{ width: 200 }}>ชี้ไปที่</th>
                        <th>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.columns.map((c) => (
                        <tr key={c.name}>
                          <td>
                            <span className="mn" style={{ fontWeight: c.primary ? 600 : 400 }}>
                              {c.name}
                            </span>
                            {c.primary ? (
                              <span className="chip" style={{ marginLeft: 6 }}>
                                PK
                              </span>
                            ) : null}
                            {c.unique ? (
                              <span className="chip" style={{ marginLeft: 6 }}>
                                unique
                              </span>
                            ) : null}
                          </td>
                          <td className="mn" style={{ color: toneOf(c.type) }}>
                            {c.type}
                            {c.hasDefault ? (
                              <span className="sub" style={{ marginLeft: 6 }}>
                                มีค่าเริ่มต้น
                              </span>
                            ) : null}
                          </td>
                          <td className="sub">{c.notNull ? '—' : 'ว่างได้'}</td>
                          <td className="mn sub">
                            {c.references ? (
                              <>
                                {c.references.table}.{c.references.column}
                                {c.references.onDelete && c.references.onDelete !== 'no action' ? (
                                  <span className="chip" style={{ marginLeft: 6 }}>
                                    {c.references.onDelete}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="sub" style={{ fontSize: 11.5 }}>
                            {c.note ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {t.indexes.length > 0 || t.uniques.length > 0 ? (
                    <div className="card-b">
                      <div className="hint mn">
                        {t.indexes.length > 0 ? `ดัชนี: ${t.indexes.join(' · ')}` : ''}
                        {t.indexes.length > 0 && t.uniques.length > 0 ? ' — ' : ''}
                        {t.uniques.length > 0 ? `บังคับไม่ซ้ำ: ${t.uniques.join(' · ')}` : ''}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        );
      })}

      {shown.length === 0 ? (
        <div className="card">
          <div className="card-b">
            <div className="empty">ไม่พบตารางหรือฟิลด์ที่ตรงกับ “{q}”</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
