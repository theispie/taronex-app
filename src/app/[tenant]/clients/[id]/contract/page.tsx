'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 34 · สัญญาและนโยบาย SLA
 *
 * ตารางระดับความสำคัญกรอกได้เอง เพราะสัญญาแต่ละฉบับไม่เหมือนกัน แต่จำนวนระดับคงที่ 4
 * กติกาการนับเวลาเป็นเช็กบ็อกซ์ ไม่ใช่ข้อความอิสระ เพื่อให้ระบบคำนวณได้จริง
 *
 * `sla_policies` เก็บเป็นเวอร์ชัน · `sla_clocks` คัดลอกเวลาเป้าหมายมาเก็บตอนสร้าง
 * เรื่องที่เปิดไปแล้วจึงไม่ขยับตามนโยบายใหม่ ปุ่มนี้จึงชื่อ "บันทึกเป็นเวอร์ชันใหม่"
 */
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface Level {
  priority: Priority;
  respondMinutes: number;
  resolveMinutes: number;
}
interface Contract {
  id: string;
  projectId: string;
  projectName: string;
  startsOn: string;
  endsOn: string;
  scopeText: string;
  renewNoticeDays: number;
}
interface Data {
  contracts: Contract[];
  policy: {
    id: string;
    version: number;
    countBusinessHours: boolean;
    pauseOnCustomer: boolean;
    pauseOnVendor: boolean;
    levels: Level[];
  } | null;
  versions: { id: string; version: number; effectiveFrom: string }[];
  defaults: Record<Priority, { respond: number; resolve: number }>;
}

const META: { priority: Priority; name: string; desc: string }[] = [
  { priority: 'critical', name: 'วิกฤต', desc: 'ระบบใช้งานไม่ได้ทั้งระบบ' },
  { priority: 'high', name: 'สูง', desc: 'ฟังก์ชันหลักใช้ไม่ได้ ไม่มีทางเลี่ยง' },
  { priority: 'medium', name: 'กลาง', desc: 'ใช้ได้แต่ติดขัด มีทางเลี่ยง' },
  { priority: 'low', name: 'ต่ำ', desc: 'ไม่กระทบการใช้งาน' },
];

/** รับได้ทั้ง "480" และ "8 ชม." ไม่ได้ ผู้ใช้กรอกเป็นนาทีเสมอ — เลยแสดงหน่วยกำกับไว้ */
function toInt(v: string): number {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ContractPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const clientId = String(p.id ?? '');

  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [levels, setLevels] = useState<Record<Priority, { respond: number; resolve: number }>>({
    low: { respond: 0, resolve: 0 },
    medium: { respond: 0, resolve: 0 },
    high: { respond: 0, resolve: 0 },
    critical: { respond: 0, resolve: 0 },
  });
  const [pauseOnCustomer, setPauseOnCustomer] = useState(true);
  const [pauseOnVendor, setPauseOnVendor] = useState(true);
  const [countBusinessHours, setCountBusinessHours] = useState(true);

  const apply = useCallback((d: Data) => {
    setData(d);
    const src = d.policy?.levels ?? [];
    const next = { ...d.defaults };
    const merged: Record<Priority, { respond: number; resolve: number }> = {
      low: { respond: next.low.respond, resolve: next.low.resolve },
      medium: { respond: next.medium.respond, resolve: next.medium.resolve },
      high: { respond: next.high.respond, resolve: next.high.resolve },
      critical: { respond: next.critical.respond, resolve: next.critical.resolve },
    };
    for (const l of src) {
      merged[l.priority] = { respond: l.respondMinutes, resolve: l.resolveMinutes };
    }
    setLevels(merged);
    setCountBusinessHours(d.policy?.countBusinessHours ?? true);
    setPauseOnCustomer(d.policy?.pauseOnCustomer ?? true);
    setPauseOnVendor(d.policy?.pauseOnVendor ?? true);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.get<Data>(`/t/${tenant}/clients/${clientId}/contract`));
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, clientId, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      const r = await api.put<Data>(`/t/${tenant}/clients/${clientId}/contract`, {
        countBusinessHours,
        pauseOnCustomer,
        pauseOnVendor,
        levels,
      });
      apply(r);
      setSaved(true);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const active = data?.contracts[0] ?? null;

  return (
    <>
      <PageHead
        title="สัญญาและนโยบาย SLA"
        desc={
          data === null
            ? 'กำลังโหลด…'
            : data.policy
              ? `นโยบายเวอร์ชัน ${data.policy.version} · สัญญา ${data.contracts.length} ฉบับ`
              : 'ยังไม่มีนโยบาย — บันทึกเพื่อสร้างเวอร์ชันแรก'
        }
        right={
          <button
            type="button"
            className="btn btn-pri btn-sm"
            disabled={busy || data === null}
            onClick={() => void save()}
          >
            บันทึกเป็นเวอร์ชันใหม่
          </button>
        }
      />
      {err ? <div className="alert e">{err}</div> : null}
      {saved ? (
        <div className="alert s">
          บันทึกเป็นเวอร์ชัน {data?.policy?.version} แล้ว · เรื่องที่เปิดไปก่อนหน้ายังใช้ค่าเดิม
        </div>
      ) : null}

      <Card className="mb">
        <div className="card-h">
          <b>ระดับความสำคัญ</b>
          <div className="r">
            <span className="sub">คงที่ 4 ระดับ · หน่วยเป็นนาทีทำการ</span>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>ระดับ</th>
              <th>ความหมาย</th>
              <th>ตอบกลับภายใน (นาที)</th>
              <th>แก้เสร็จภายใน (นาที)</th>
            </tr>
          </thead>
          <tbody>
            {META.map((l) => (
              <tr key={l.priority}>
                <td>
                  <span className="chip">{l.name}</span>
                </td>
                <td className="sub">{l.desc}</td>
                <td>
                  <input
                    className="inp mn"
                    style={{ maxWidth: 130 }}
                    value={levels[l.priority].respond}
                    onChange={(e) =>
                      setLevels((s) => ({
                        ...s,
                        [l.priority]: { ...s[l.priority], respond: toInt(e.target.value) },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    className="inp mn"
                    style={{ maxWidth: 150 }}
                    value={levels[l.priority].resolve}
                    onChange={(e) =>
                      setLevels((s) => ({
                        ...s,
                        [l.priority]: { ...s[l.priority], resolve: toInt(e.target.value) },
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid2">
        <Card>
          <div className="card-h">
            <b>กติกาการนับเวลา</b>
          </div>
          <div className="card-b">
            <label className="chkrow">
              <input
                type="checkbox"
                checked={countBusinessHours}
                onChange={(e) => setCountBusinessHours(e.target.checked)}
              />
              <span>นับเฉพาะเวลาทำการของที่ทำงาน (ตั้งที่หน้าตั้งค่า)</span>
            </label>
            <label className="chkrow">
              <input
                type="checkbox"
                checked={pauseOnCustomer}
                onChange={(e) => setPauseOnCustomer(e.target.checked)}
              />
              <span>หยุดนาฬิกาเมื่อรอลูกค้าตอบ</span>
            </label>
            <label className="chkrow">
              <input
                type="checkbox"
                checked={pauseOnVendor}
                onChange={(e) => setPauseOnVendor(e.target.checked)}
              />
              <span>หยุดนาฬิกาเมื่อรอผู้ให้บริการภายนอก</span>
            </label>
            <div className="hint" style={{ marginTop: 8 }}>
              เป็นเช็กบ็อกซ์ ไม่ใช่ข้อความอิสระ เพราะระบบต้องคำนวณได้จริง
              วันหยุดราชการไทยข้ามให้อัตโนมัติเสมอเมื่อนับเฉพาะเวลาทำการ
            </div>
          </div>
        </Card>
        <Card>
          <div className="card-h">
            <b>ช่วงเวลาสัญญา</b>
          </div>
          <div className="card-b">
            {active ? (
              <>
                <div className="kv">
                  <span>โปรเจกต์</span>
                  <b>{active.projectName}</b>
                </div>
                <div className="kv">
                  <span>เริ่ม</span>
                  <b className="mn">{fmtDate(active.startsOn)}</b>
                </div>
                <div className="kv">
                  <span>สิ้นสุด</span>
                  <b className="mn">{fmtDate(active.endsOn)}</b>
                </div>
              </>
            ) : (
              <div className="sub">ยังไม่มีสัญญาประกัน — สัญญาเปิดเองเมื่อกดส่งมอบโปรเจกต์</div>
            )}
            <div className="kv">
              <span>เวอร์ชันนโยบาย</span>
              <b className="mn">v{data?.policy?.version ?? 0}</b>
            </div>
            <div className="alert w" style={{ marginTop: 12 }}>
              <span>⚠</span>
              <div>
                แก้นโยบายแล้ว<b>ไม่มีผลย้อนหลัง</b> — เรื่องที่เปิดไปแล้วยังใช้เงื่อนไขเวอร์ชันเดิมจนกว่าจะปิด
              </div>
            </div>
            {data && data.contracts.length > 1 ? (
              <div className="hint" style={{ marginTop: 10 }}>
                ลูกค้ารายนี้มีสัญญา {data.contracts.length} ฉบับ (ฉบับละโปรเจกต์) นโยบาย SLA ใช้ร่วมกันทุกฉบับ
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
