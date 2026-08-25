'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 09 · เชิญสมาชิก
 *
 * ใส่หลายอีเมลพร้อมกันได้ เพราะเวลาเปิดทีมใหม่มักเชิญทีเดียวหลายคน
 * **โควตาที่นั่งบอกตรงนี้** ไม่ใช่ให้ไปเจอตอนกดส่งแล้วเด้ง error
 *
 * ═══ กฎข้อ 7 ═══
 * ที่นั่งเต็มแล้วปิดแค่การเชิญคนใหม่ ไม่แตะคนที่อยู่แล้วแม้แต่คนเดียว
 * ปุ่มจึงปิดตัวเองพร้อมบอกว่าต้องทำอะไร แทนที่จะปล่อยให้กดแล้วค่อยบอกว่าไม่ได้
 */
interface PlanView {
  current: string;
  usage: { projects: number; seats: number };
  limits: { projects: number; seats: number };
}

const ROLES = [
  { key: 'member', label: 'สมาชิก — ร่วมงานได้ทุกโปรเจกต์' },
  { key: 'viewer', label: 'ผู้ชม — เห็นทุกอย่างแต่แก้ไม่ได้' },
  { key: 'owner', label: 'เจ้าของ — จัดการที่ทำงานได้' },
];

const TITLES = [
  { key: 'pm', label: 'PM' },
  { key: 'ba', label: 'BA' },
  { key: 'dev', label: 'Dev' },
  { key: 'qa', label: 'QA' },
  { key: 'design', label: 'Design' },
  { key: 'other', label: 'อื่นๆ' },
];

export default function InviteMembersPage() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();

  const [plan, setPlan] = useState<PlanView | null>(null);
  const [raw, setRaw] = useState('');
  const [role, setRole] = useState('member');
  const [jobTitle, setJobTitle] = useState('dev');
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await api.get<PlanView>(`/t/${tenant}/plans`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  // บรรทัดละหนึ่งคน · รับคอมมาคั่นด้วยเพราะคนชอบก๊อปมาจากอีเมล
  const emails = raw
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const bad = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const left = plan ? plan.limits.seats - plan.usage.seats : null;
  const overSeats = left !== null && emails.length > left;

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ invited: string[]; count: number }>(
        `/t/${tenant}/members/invite`,
        { emails, role, jobTitle },
      );
      setSent(r.invited);
      setRaw('');
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="เชิญสมาชิก"
        desc={plan ? `เหลือที่นั่ง ${Math.max(0, left ?? 0)} จาก ${plan.limits.seats}` : 'กำลังโหลด…'}
      />
      <div style={{ maxWidth: 560 }}>
        {err ? <div className="alert e">{err}</div> : null}
        {sent ? (
          <div className="alert s">
            ส่งคำเชิญแล้ว {sent.length} คน — {sent.join(' · ')}
            <br />
            <span className="hint">ยังไม่ได้ต่อบริการส่งอีเมล ลิงก์คำเชิญจึงอยู่ใน log ของเซิร์ฟเวอร์ก่อน</span>
          </div>
        ) : null}

        <Card>
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="ems">
                อีเมล
              </label>
              <textarea
                id="ems"
                className="inp mn"
                rows={4}
                placeholder={'bee@digitalx.co.th\nkorn@digitalx.co.th'}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <div className="hint">
                ใส่ได้หลายอีเมล บรรทัดละหนึ่งคน
                {emails.length > 0 ? ` · ตอนนี้ ${emails.length} คน` : ''}
              </div>
              {bad.length > 0 ? (
                <div className="hint" style={{ color: 'var(--danger)' }}>
                  รูปแบบอีเมลไม่ถูกต้อง: {bad.join(' · ')}
                </div>
              ) : null}
            </div>

            <div className="fld">
              <label className="lbl" htmlFor="rl">
                สิทธิ์
              </label>
              <select
                id="rl"
                className="inp"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="fld" style={{ marginBottom: 16 }}>
              <label className="lbl" htmlFor="jt">
                ตำแหน่งงาน
              </label>
              <select
                id="jt"
                className="inp"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              >
                {TITLES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="hint">ตำแหน่งงานใช้แสดงผลและกรองงานเท่านั้น ไม่เปลี่ยนสิทธิ์</div>
            </div>

            {overSeats ? (
              <div className="alert w" style={{ marginBottom: 14 }}>
                <span>⚠</span>
                <div>
                  เชิญ {emails.length} คน แต่เหลือที่นั่ง {Math.max(0, left ?? 0)} —
                  ปิดบัญชีคนที่ไม่ได้ใช้แล้วเพื่อคืนที่นั่ง หรืออัปเกรดแผน
                  <br />
                  <b>ที่นั่งเต็มไม่กระทบคนที่อยู่แล้วแม้แต่คนเดียว</b> ปิดแค่การเชิญคนใหม่
                </div>
              </div>
            ) : (
              <div className="alert i" style={{ marginBottom: 14 }}>
                <span>ℹ</span>
                <div>
                  คนที่เข้ามาใหม่จะเห็นทุกโปรเจกต์ในที่ทำงานนี้ ถ้าต้องการจำกัดให้ตั้งค่าที่หน้าสิทธิ์ของแต่ละโปรเจกต์
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-pri"
                disabled={busy || emails.length === 0 || bad.length > 0 || overSeats}
                onClick={() => void send()}
              >
                ส่งคำเชิญ
              </button>
              <Link href={`/${tenant}/settings/members`} className="btn btn-2">
                ยกเลิก
              </Link>
              {sent ? (
                <button
                  type="button"
                  className="btn btn-2"
                  onClick={() => router.push(`/${tenant}/settings/members`)}
                >
                  ดูรายชื่อสมาชิก
                </button>
              ) : null}
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              คำเชิญมีอายุ 7 วัน · เชิญซ้ำอีเมลเดิมจะทำให้ลิงก์เดิมเป็นโมฆะและส่งใหม่
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
