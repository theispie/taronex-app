'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 36 · โควตาเต็ม / ถูกระงับ
 *
 * เสนอทางออกที่**ไม่ต้องจ่ายเงิน**เป็นทางเลือกแรก และวางคู่กันในระดับเดียวกัน ไม่ซ่อน
 * บอกชัดว่าข้อมูลไม่ถูกลบในทุกกรณี — เป็นความกลัวอันดับหนึ่งของคนใช้ SaaS
 *
 * ═══ กฎข้อ 7 ═══
 * "ปิดโปรเจกต์" ไม่ใช่ "ลบ" · ปิดแล้วโควตาคืนทันทีและข้อมูลอยู่ครบ
 * ปุ่มปิดที่นี่เรียก endpoint เดียวกับหน้าแก้ไขโปรเจกต์ ไม่มีทางลัดอื่น
 */
interface Plan {
  key: string;
  name: string;
  projects: number;
  seats: number;
  price: number;
}
interface PlanView {
  current: string;
  plans: Plan[];
  usage: { projects: number; seats: number };
  limits: { projects: number; seats: number };
  note: string;
}
interface Project {
  id: string;
  key: string;
  name: string;
  deliveredAt: string | null;
  isArchived: boolean;
}

const STATUS_ROWS = [
  ['ใช้งานอยู่', 'st-done', 'ชำระเงินปกติ', 'ใช้ได้เต็มที่'],
  ['ค้างชำระ', 'st-doing', 'เลยกำหนด 7 วัน', 'อ่านได้ แก้ไม่ได้ · ข้อมูลอยู่ครบ'],
  ['ถูกระงับ', 'st-blocked', 'เลยกำหนด 30 วัน', 'เข้าไม่ได้ชั่วคราว · ข้อมูลยังอยู่ครบ'],
];

export default function LimitsPage() {
  const tenant = String(useParams().tenant ?? '');
  const [v, setV] = useState<PlanView | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plans, list] = await Promise.all([
        api.get<PlanView>(`/t/${tenant}/plans`),
        api.get<Project[]>(`/t/${tenant}/projects`),
      ]);
      setV(plans);
      setProjects(list);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(key: string) {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/projects/${key}/archive`, { archived: true });
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const current = v?.plans.find((p) => p.key === v.current);
  const next = v ? v.plans.find((p) => p.projects > (current?.projects ?? 0)) : undefined;
  const full = v ? v.usage.projects >= v.limits.projects : false;
  // เสนอโปรเจกต์ที่ส่งมอบแล้วก่อน เพราะปิดได้โดยไม่กระทบงานที่ยังเดินอยู่
  const closable = [...projects].sort((a, b) =>
    a.deliveredAt === b.deliveredAt ? 0 : a.deliveredAt ? -1 : 1,
  );

  return (
    <>
      <PageHead
        title={full ? 'โควตาเต็ม' : 'แผนและโควตา'}
        desc={
          v
            ? `ใช้ไป ${v.usage.projects}/${v.limits.projects} โปรเจกต์ · ${v.usage.seats}/${v.limits.seats} ที่นั่ง`
            : 'กำลังโหลด…'
        }
      />
      {err ? <div className="alert e">{err}</div> : null}

      <div className="alert o" style={{ marginBottom: 16 }}>
        <span>✓</span>
        <div>
          <b>ข้อมูลของคุณยังอยู่ครบทุกอย่าง</b> — โควตาเต็ม ลดแผน ค้างชำระ หรือถูกระงับ ล้วนปิดแค่การเข้าถึงชั่วคราว
          ไม่มีกรณีไหนที่ระบบลบข้อมูล
        </div>
      </div>

      <div className="grid2">
        <Card>
          <div className="card-h">
            <b>ปิดโปรเจกต์ที่จบแล้ว</b>
            <div className="r">
              <span className="chip st-done">ไม่ต้องจ่ายเพิ่ม</span>
            </div>
          </div>
          <div className="card-b">
            <p className="sub" style={{ marginBottom: 12 }}>
              ปิดโปรเจกต์ที่ส่งมอบเรียบร้อยแล้ว โควตาคืนทันที และเปิดกลับมาดูได้ตลอด
            </p>
            {closable.length === 0 ? (
              <div className="empty">ยังไม่มีโปรเจกต์ที่เปิดอยู่</div>
            ) : (
              closable.map((p) => (
                <div className="row" style={{ padding: '8px 0' }} key={p.id}>
                  <span className="row-title">{p.name}</span>
                  <span className="sub">{p.deliveredAt ? 'ส่งมอบแล้ว' : 'ยังไม่ส่งมอบ'}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-2"
                    disabled={busy}
                    onClick={() => void archive(p.key)}
                  >
                    ปิดโปรเจกต์
                  </button>
                </div>
              ))
            )}
            <div className="hint" style={{ marginTop: 8 }}>
              ปิด ≠ ลบ — ข้อมูลยังอยู่ครบ เปิดคืนได้ที่หน้าแก้ไขโปรเจกต์
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>อัปเกรดแผน</b>
          </div>
          <div className="card-b">
            {next ? (
              <>
                <p className="sub" style={{ marginBottom: 12 }}>
                  แผน{next.name} เปิดได้ {next.projects} โปรเจกต์ และที่นั่ง {next.seats} คน
                </p>
                <div className="kv">
                  <span>ตอนนี้</span>
                  <b>
                    {current?.name} · {current?.projects} โปรเจกต์
                  </b>
                </div>
                <div className="kv">
                  <span>อัปเกรดเป็น</span>
                  <b>
                    {next.name} · {next.projects} โปรเจกต์ · {next.price.toLocaleString('th-TH')}{' '}
                    บาท/เดือน
                  </b>
                </div>
              </>
            ) : (
              <p className="sub">คุณอยู่แผนสูงสุดแล้ว</p>
            )}
            <div className="hint" style={{ marginTop: 12 }}>
              ยังเปลี่ยนแผนเองในระบบไม่ได้ — ติดต่อทีมงานเพื่ออัปเกรด
              <br />
              ระบบตั้งใจไม่มีปุ่มลดแผนแบบกดเอง เพราะการลดแผนตอนที่ใช้เกินโควตาอยู่ ต้องมีคนอธิบายก่อนว่าจะเกิดอะไรขึ้น
              (คำตอบคือ ไม่มีข้อมูลไหนหาย แค่เปิดโปรเจกต์ใหม่ไม่ได้)
            </div>
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <div className="card-h">
          <b>สถานะบัญชี</b>
        </div>
        <div className="card-b">
          <table className="tbl">
            <thead>
              <tr>
                <th>สถานะ</th>
                <th>เกิดขึ้นเมื่อ</th>
                <th>ผลกับข้อมูล</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ROWS.map((r) => (
                <tr key={r[0]}>
                  <td>
                    <span className={`chip ${r[1]}`}>{r[0]}</span>
                  </td>
                  <td className="sub">{r[2]}</td>
                  <td className="sub">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="hint" style={{ marginTop: 10 }}>
            {v?.note}
          </div>
        </div>
      </Card>
    </>
  );
}
