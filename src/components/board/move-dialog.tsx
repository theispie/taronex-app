'use client';

import { useState } from 'react';
import type { BoardMember } from './types';

/**
 * กล่องที่โผล่ตอนย้ายการ์ด — เนื้อในต่างกันตามทิศทาง ไม่ใช่ตามชื่อคอลัมน์
 *
 * ถอยหลัง → บังคับใส่เหตุผล เพราะคนที่รับงานกลับไปต้องรู้ว่าต้องแก้อะไร
 * ไปข้างหน้า → เลือกว่าใครรับต่อ · ค่าเริ่มต้นคือ "ให้ PM หาคนตรวจ"
 *              เรียงคนที่ถือน้อยสุดขึ้นก่อน เพื่อไม่ให้งานไปกองที่คนเดิม
 *
 * ไม่มีที่ไหนในกล่องนี้ที่อ่านชื่อคอลัมน์มาตัดสิน — ใช้ทิศทางล้วน (กฎข้อ 8)
 */
export function MoveDialog({
  kind,
  toColumnName,
  members,
  onCancel,
  onConfirm,
}: {
  kind: 'forward' | 'backward';
  toColumnName: string;
  members: BoardMember[];
  onCancel: () => void;
  onConfirm: (v: { reason?: string; assigneeId?: string | null }) => void;
}) {
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // ถือน้อยสุดขึ้นก่อน — งานจะได้ไม่ไปกองที่คนเดิม
  const sorted = [...members].sort((a, b) => a.holding - b.holding);

  return (
    <div className="pw">
      <div className="pw-card">
        <div className="pw-top">
          <b>{kind === 'backward' ? `ตีกลับไป “${toColumnName}”` : `ย้ายไป “${toColumnName}”`}</b>
        </div>
        <div className="pw-in">
          {kind === 'backward' ? (
            <>
              <p className="sub" style={{ marginBottom: 10 }}>
                การ์ดจะกลับไปหาเจ้าของคนก่อน — เขาต้องรู้ว่าต้องแก้อะไร
              </p>
              <div className="fld">
                <span className="lbl">เหตุผลที่ตีกลับ</span>
                <input
                  className="inp"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น ส่วนลดซ้อนกันยังคำนวณผิดตอนใส่คูปองสองใบ"
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-dn"
                  disabled={!reason.trim()}
                  onClick={() => onConfirm({ reason })}
                >
                  ตีกลับ
                </button>
                <button type="button" className="btn btn-2" onClick={onCancel}>
                  ยกเลิก
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="fld">
                <span className="lbl">ใครรับต่อ</span>
                <select
                  className="inp"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">ให้ PM หาคนตรวจ</option>
                  {sorted.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} · ถืออยู่ {m.holding} ใบ
                    </option>
                  ))}
                </select>
                <div className="hint">เรียงคนที่ถือน้อยสุดขึ้นก่อน</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-pri"
                  onClick={() => onConfirm({ assigneeId: assigneeId || null })}
                >
                  ย้ายการ์ด
                </button>
                <button type="button" className="btn btn-2" onClick={onCancel}>
                  ยกเลิก
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
