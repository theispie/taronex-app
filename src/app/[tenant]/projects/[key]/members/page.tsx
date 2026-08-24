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
 * รายชื่อยกเว้นอยู่ที่แท็บ "สิทธิ์" หน้านี้แสดงว่าใครเข้าถึงโปรเจกต์นี้ได้จริงบ้าง
 *
 * เดิมหน้านี้อ่าน `/members` ซึ่งเป็นรายชื่อ**ทั้งที่ทำงาน** จึงโชว์คนที่เข้าโปรเจกต์นี้ไม่ได้ด้วย
 * ย้ายมาอ่าน `/projects/:id/members` ที่กรองด้วย `resolveAccess()` ให้แล้ว (กฎข้อ 10)
 *
 * "ถืออยู่" แสดงเป็น**รหัสการ์ด ไม่ใช่จำนวน** (กฎข้อ 9)
 * จำนวนเอาไปเรียงลำดับคนได้ · รหัสเอาไปเปิดดูได้ว่าติดอะไรอยู่
 */
type Access = 'none' | 'read' | 'write';

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  jobTitle: string;
  override: 'read' | 'write' | null;
  isPm: boolean;
  effective: Access;
  holding: string[];
}

interface View {
  name: string;
  memberAccess: 'collaborate' | 'read_only';
  pmUserId: string | null;
  members: MemberRow[];
}

export default function ProjectMembersPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<View>(`/t/${tenant}/projects/${key}/members`)
      .then(setV)
      .catch((e) => {
        setErr(errorText(e));
        setV(null);
      });
  }, [tenant, key]);

  // คนที่ effective = none เข้าโปรเจกต์นี้ไม่ได้ ไม่ต้องอยู่ในรายชื่อทีมงาน
  const rows = v ? v.members.filter((m) => m.effective !== 'none') : null;

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
                {m.isPm ? <span className="chip st-review">PM ของโปรเจกต์นี้</span> : null}
                {m.effective === 'read' ? <span className="chip st-todo">ดูอย่างเดียว</span> : null}
                {m.override ? <span className="chip">ยกเว้นรายคน</span> : null}
                <span className="sub mn">
                  {m.holding.length > 0 ? `ถืออยู่ ${m.holding.join(' · ')}` : 'ไม่ได้ถือการ์ด'}
                </span>
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
