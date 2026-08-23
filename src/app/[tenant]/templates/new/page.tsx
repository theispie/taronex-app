'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 40ก · บันทึกโปรเจกต์เป็นแม่แบบ
 *
 * ระบบตัดชื่อคน วันจริง และไฟล์ออกให้เอง — คนใช้ไม่ต้องมานั่งลบทีละอัน
 * และไม่มีทางลืมลบ ซึ่งเป็นเรื่องที่ลืมง่ายมาก
 */
interface Project {
  id: string;
  key: string;
  name: string;
  taskCount: number;
}

export default function SaveAsTemplatePage() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Project[]>(`/t/${tenant}/projects?archived=all`)
      .then((ps) => {
        setProjects(ps);
        if (ps[0]) {
          setProjectId(ps[0].id);
          setName(`${ps[0].name} (แม่แบบ)`);
        }
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/templates/from-project/${projectId}`, { name });
      router.push(`/${tenant}/templates`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="บันทึกโปรเจกต์เป็นแม่แบบ" desc="ถอดโครงงานออกมาใช้ซ้ำ" />
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
              <span className="lbl">โปรเจกต์ต้นทาง</span>
              <select
                className="inp"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const p = projects.find((x) => x.id === e.target.value);
                  if (p) setName(`${p.name} (แม่แบบ)`);
                }}
                required
              >
                {projects.length === 0 ? <option value="">— ยังไม่มีโปรเจกต์ —</option> : null}
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name} ({p.taskCount} การ์ด)
                  </option>
                ))}
              </select>
            </div>

            <div className="fld" style={{ marginBottom: 14 }}>
              <span className="lbl">ชื่อแม่แบบ</span>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="alert i">
              <span>ℹ</span>
              <div>
                ระบบจะ<b>ตัดชื่อคน วันจริง และไฟล์ออกให้เอง</b> — เก็บวันเป็นระยะห่างจากวันเริ่มแทน
                แม่แบบจึงใช้ซ้ำได้ไม่ว่าโปรเจกต์ใหม่จะเริ่มวันไหน
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-pri" disabled={busy || projects.length === 0}>
            {busy ? 'กำลังบันทึก…' : 'บันทึกเป็นแม่แบบ'}
          </button>
          <Link href={`/${tenant}/templates`} className="btn btn-2">
            ยกเลิก
          </Link>
        </div>
      </form>
    </>
  );
}
