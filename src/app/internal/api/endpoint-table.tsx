'use client';

import { useMemo, useState } from 'react';
import type { EndpointGroup, ImplStatus, Scope } from '@/lib/api/registry';

const SCOPE_LABEL: Record<Scope, string> = {
  public: 'ไม่ต้องล็อกอิน',
  account: 'ข้ามที่ทำงาน',
  tenant: 'ในที่ทำงาน',
  portal: 'พอร์ทัล',
  meta: 'ระบบ',
};

const STATUS_LABEL: Record<ImplStatus, string> = {
  live: 'ใช้ได้แล้ว',
  partial: 'ทำบางส่วน',
  planned: 'ยังไม่ทำ',
};

const STATUS_TONE: Record<ImplStatus, string> = {
  live: 'st-done',
  partial: 'st-doing',
  planned: 'st-todo',
};

/**
 * ทะเบียนทั้งชุดพร้อมช่องกรอง
 * ไม่มีข้อมูลผู้ใช้ในตารางนี้เลย มีแต่รูปร่างของ API — เปิดดูได้ปลอดภัย
 */
export function EndpointTable({ groups }: { groups: EndpointGroup[] }) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope | 'all'>('all');
  const [status, setStatus] = useState<ImplStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .map((g) => ({
        name: g.name,
        endpoints: g.endpoints.filter((e) => {
          if (scope !== 'all' && e.scope !== scope) return false;
          if (status !== 'all' && e.status !== status) return false;
          if (!needle) return true;
          return (
            e.path.toLowerCase().includes(needle) ||
            e.summary.toLowerCase().includes(needle) ||
            e.method.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((g) => g.endpoints.length > 0);
  }, [groups, q, scope, status]);

  const shown = filtered.reduce((n, g) => n + g.endpoints.length, 0);

  return (
    <>
      <div className="ifilter">
        <input
          className="inp"
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder="ค้นเส้นทาง เช่น /tasks หรือ transition"
        />
        <select
          className="inp"
          style={{ width: 'auto' }}
          value={scope}
          onChange={(ev) => setScope(ev.target.value as Scope | 'all')}
        >
          <option value="all">ทุกขอบเขต</option>
          {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
            <option key={s} value={s}>
              {SCOPE_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="inp"
          style={{ width: 'auto' }}
          value={status}
          onChange={(ev) => setStatus(ev.target.value as ImplStatus | 'all')}
        >
          <option value="all">ทุกสถานะ</option>
          {(Object.keys(STATUS_LABEL) as ImplStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="sub">แสดง {shown} รายการ</span>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">ไม่พบเส้นทางที่ตรงกับที่กรอง</div>
        ) : (
          filtered.map((g) => (
            <div key={g.name}>
              <div className="igrp">{g.name}</div>
              {g.endpoints.map((e) => (
                <div className="irow" key={`${e.method} ${e.path}`}>
                  <span className={`imeth m-${e.method.toLowerCase()}`}>{e.method}</span>
                  <div>
                    <div className="ipath">{e.path}</div>
                    <div className="s">{e.summary}</div>
                    {e.note ? <div className="note">※ {e.note}</div> : null}
                  </div>
                  <div className="meta">
                    {e.rules?.length ? (
                      <span className="chip" title="กฎที่ endpoint นี้ต้องบังคับ">
                        กฎ {e.rules.join(', ')}
                      </span>
                    ) : null}
                    {e.access ? (
                      <span className="chip">{e.access === 'write' ? 'เขียน' : 'อ่าน'}</span>
                    ) : null}
                    <span className="chip">{e.milestone}</span>
                    <span className={`chip ${STATUS_TONE[e.status]}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
