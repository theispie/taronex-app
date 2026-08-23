'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 21 · สร้างการ์ด
 *
 * ไม่มีช่องให้เลือกคอลัมน์โดยตั้งใจ — การ์ดใหม่ลงคอลัมน์แรกเสมอ (กฎข้อ 8)
 * ถ้าเลือกได้ จะมีคนสร้างการ์ดลงคอลัมน์ "เสร็จ" ตรงๆ
 * แล้วประวัติจะไม่มีร่องรอยว่าเคยผ่านขั้นไหน ทำให้ตัวเลขทั้งระบบเชื่อถือไม่ได้
 */
interface Feature {
  id: string;
  name: string;
}
interface Member {
  userId: string;
  name: string;
}

export default function NewTicketPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [firstColumn, setFirstColumn] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [featureId, setFeatureId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Feature[]>(`/t/${tenant}/projects/${key}/features`),
      api.get<Member[]>(`/t/${tenant}/members`),
      api.get<{ board: { name: string }[] }>(`/t/${tenant}/projects/${key}`),
    ])
      .then(([fs, ms, proj]) => {
        setFeatures(fs);
        setMembers(ms);
        setFirstColumn(proj.board[0]?.name ?? '');
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant, key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ code: string }>(`/t/${tenant}/projects/${key}/tasks`, {
        title,
        description,
        priority,
        featureId: featureId || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      router.push(`/${tenant}/tickets/${r.code}`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title={`${key} · การ์ดใหม่`} desc={`ลงที่คอลัมน์ “${firstColumn}” เสมอ`} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      <form onSubmit={submit}>
        <Card className="mb">
          <div className="card-b">
            {err ? (
              <div className="alert d" style={{ marginBottom: 14 }}>
                <span>✕</span>
                <div>{err}</div>
              </div>
            ) : null}

            <div className="fld">
              <span className="lbl">ชื่อการ์ด</span>
              <input
                className="inp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ทำหน้าตะกร้าสินค้า"
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">รายละเอียด</span>
              <input
                className="inp"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ไม่บังคับ"
              />
            </div>

            <div className="row2">
              <div className="fld">
                <span className="lbl">งานหลัก</span>
                <select
                  className="inp"
                  value={featureId}
                  onChange={(e) => setFeatureId(e.target.value)}
                >
                  <option value="">— งานนอกแผน —</option>
                  {features.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <span className="lbl">ผู้รับผิดชอบ</span>
                <select
                  className="inp"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">— ยังไม่กำหนด —</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row2">
              <div className="fld">
                <span className="lbl">ความเร่งด่วน</span>
                <select
                  className="inp"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">ต่ำ</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">สูง</option>
                  <option value="critical">ด่วนมาก</option>
                </select>
              </div>
              <div className="fld">
                <span className="lbl">กำหนดส่ง</span>
                <input
                  className="inp mn"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="hint">
              ไม่มีช่องเลือกคอลัมน์ — การ์ดใหม่ลงคอลัมน์แรกเสมอ แล้วลากย้ายเอา ระบบจะได้รู้ว่างานเดินผ่านขั้นไหนมาบ้าง
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-pri" disabled={busy}>
            {busy ? 'กำลังสร้าง…' : 'สร้างการ์ด'}
          </button>
          <Link href={`/${tenant}/projects/${key}/list`} className="btn btn-2">
            ยกเลิก
          </Link>
        </div>
      </form>
    </>
  );
}
