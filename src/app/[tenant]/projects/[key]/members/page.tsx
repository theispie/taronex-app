'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Avatar, Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 14 · ทีมงานในโปรเจกต์
 *
 * สมาชิกทั่วไปไม่ต้องมีแถวในตารางสิทธิ์รายโปรเจกต์ — ใช้ค่าเริ่มต้นของโปรเจกต์
 * มีแถวเฉพาะคนที่ตั้งยกเว้นไว้ กับแขกที่ถูกเชิญเข้าโปรเจกต์นี้โดยตรง
 * รายชื่อยกเว้นอยู่ที่แท็บ "สิทธิ์" หน้านี้แสดงว่าใครทำงานอยู่จริงบ้าง
 */
interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
  active: boolean;
  holding: number;
  pmOf: string[];
}

export default function ProjectMembersPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [rows, setRows] = useState<Member[] | null>(null);
  const [pmId, setPmId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Member[]>(`/t/${tenant}/members`),
      api.get<{ pmUserId: string | null }>(`/t/${tenant}/projects/${key}`),
    ])
      .then(([list, proj]) => {
        setRows(list.filter((m) => m.active));
        setPmId(proj.pmUserId);
      })
      .catch((e) => {
        setErr(errorText(e));
        setRows([]);
      });
  }, [tenant, key]);

  return (
    <>
      <PageHead title={`${key} · ทีมงาน`} desc="ใครทำงานอยู่ในโปรเจกต์นี้บ้าง" />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card>
        <div className="card-b">
          {rows === null ? (
            <div className="hint">กำลังโหลด…</div>
          ) : rows.length === 0 ? (
            <div className="empty">ยังไม่มีสมาชิก</div>
          ) : (
            rows.map((m) => (
              <div className="row" key={m.userId}>
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
                <span className="row-title">{m.name}</span>
                <span className="sub mn">{m.jobTitle}</span>
                {m.userId === pmId ? <span className="chip st-review">PM ของโปรเจกต์นี้</span> : null}
                <span className="sub mn">ถืออยู่ {m.holding} ใบ</span>
              </div>
            ))
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            PM เป็นคนเดียวที่ย้ายการ์ดเข้าคอลัมน์สุดท้ายได้ · ตั้ง PM ได้ที่หน้าแก้ไขโปรเจกต์
          </div>
        </div>
      </Card>

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>
          สมาชิกทั่วไปเข้าโปรเจกต์ได้ตามค่าเริ่มต้นของโปรเจกต์ ไม่ต้องเพิ่มทีละคน ตั้งข้อยกเว้นรายคนและเชิญแขกได้ที่แท็บ
          “สิทธิ์”
        </div>
      </div>
    </>
  );
}
