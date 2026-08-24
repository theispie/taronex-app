'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 31 · พอร์ทัล — แจ้งปัญหาใหม่
 *
 * ระดับความรุนแรงเขียนด้วยผลกระทบต่องาน ไม่ใช่คำว่า วิกฤต/สูง/กลาง ที่ลูกค้าตีความไม่ตรงกัน
 * บอกว่าทีมอาจปรับระดับ — กันความคาดหวังว่ากดวิกฤตแล้วต้องได้เร็วเสมอ
 * ระดับที่ลูกค้าเลือกเก็บใน `reported_impact` แยกจาก `priority` ที่ทีมตั้ง
 *
 * ⚠ กดส่งแล้ว**นาฬิกา SLA เริ่มเดินทันที** (ตัดสิน 20 ส.ค. 2569)
 * แต่ไม่บอกลูกค้าตรงนี้ — ตัวเลข SLA ไม่ออกไปฝั่งลูกค้าเลย (กฎข้อ 6)
 */
const IMPACTS = [
  { key: 'blocking', label: 'ทำงานต่อไม่ได้เลย', desc: 'ระบบใช้งานไม่ได้ ต้องหยุดงาน' },
  { key: 'degraded', label: 'ยังทำงานได้แต่ติดขัด', desc: 'มีทางเลี่ยง แต่ไม่สะดวก' },
  { key: 'minor', label: 'เรื่องเล็กน้อย', desc: 'ไม่กระทบงาน แต่อยากให้แก้' },
] as const;

interface Data {
  me: { canReport: boolean };
  projects: { id: string; key: string; name: string }[];
}

export default function PortalNew() {
  const slug = String(useParams().slug ?? '');
  const router = useRouter();

  const [data, setData] = useState<Data | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<string>('degraded');
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<Data>(`/portal/${slug}/issues`);
      setData(d);
      if (d.projects.length === 1) setProjectId(d.projects[0]?.id ?? '');
    } catch (e) {
      if (e instanceof ApiCallError && e.code === 'E_UNAUTHENTICATED') {
        router.replace(`/portal/${slug}/login`);
        return;
      }
      setErr(errorText(e));
    }
  }, [slug, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ code: string }>(`/portal/${slug}/issues`, {
        title,
        description,
        reportedImpact: impact,
        projectId: projectId || undefined,
      });
      router.push(`/portal/${slug}/i/${r.code}`);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  const many = (data?.projects.length ?? 0) > 1;

  return (
    <>
      <div className="pw-head">
        <div>
          <h1>แจ้งปัญหา</h1>
          <p className="sub">กรอกเท่าที่รู้ก็พอ</p>
        </div>
      </div>
      <div className="pw-card">
        <div className="card-b">
          {err ? <div className="alert e">{err}</div> : null}

          {many ? (
            <div className="fld">
              <label className="lbl" htmlFor="pp">
                เรื่องนี้เกี่ยวกับงานไหน
              </label>
              <select
                id="pp"
                className="inp"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">เลือกงาน…</option>
                {data?.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="fld">
            <label className="lbl" htmlFor="pt">
              เรื่องที่พบ
            </label>
            <input
              id="pt"
              className="inp"
              placeholder="เช่น ฟอร์มติดต่อกดส่งแล้วไม่มีอีเมลเข้า"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="fld">
            <label className="lbl" htmlFor="pd">
              รายละเอียด
            </label>
            <textarea
              id="pd"
              className="inp"
              rows={5}
              placeholder="เกิดตอนไหน หน้าไหน และเกิดกับทุกคนหรือเฉพาะบางเครื่อง"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="hint">กรอกเท่าที่รู้ก็พอ ไม่ต้องกลัวแจ้งผิด</div>
          </div>

          <div className="fld">
            <span className="lbl">กระทบงานของคุณแค่ไหน</span>
            {IMPACTS.map((im) => (
              <label key={im.key} className="radrow">
                <input
                  type="radio"
                  name="impact"
                  checked={impact === im.key}
                  onChange={() => setImpact(im.key)}
                />
                <span>
                  <b>{im.label}</b>
                  <br />
                  <span className="sub">{im.desc}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="alert i" style={{ margin: '12px 0' }}>
            <span>ℹ</span>
            <div>ทีมอาจปรับระดับความเร่งด่วนหลังตรวจสอบ เพื่อจัดลำดับให้เหมาะกับผลกระทบจริง</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ws btn-lg"
              disabled={busy || !title.trim() || (many && !projectId)}
              onClick={() => void submit()}
            >
              ส่งเรื่อง
            </button>
            <Link href={`/portal/${slug}`} className="btn btn-2 btn-lg">
              ยกเลิก
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
