'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * ═══ ทำไม `save()` อ่านจาก ref ไม่ใช่จาก state ═══
 * เดิมอ่านจาก state ตรงๆ ซึ่งเป็นค่าที่ถูก "ปิดตาย" ไว้ตอน render รอบนั้น
 * ถ้ากดบันทึก**เร็วกว่าที่ React จะ render รอบใหม่** ปุ่มจะยิงค่าก่อนหน้าออกไป
 * แล้วบันทึกเป็นเวอร์ชันใหม่ด้วยตัวเลขเดิม โดยหน้ายังขึ้นว่า "บันทึกแล้ว" ตามปกติ
 *
 * ตามจริงคนพิมพ์แล้วกดไม่เร็วขนาดนั้น เจอจากเทสต์เบราว์เซอร์ที่ `fill()` แล้ว `click()`
 * ทันที (ล้มประมาณหนึ่งในสามรอบ) — แต่**ผลของมันคือเขียนค่าผิดแบบเงียบๆ**
 * แล้วยังบอกว่าสำเร็จ ซึ่งย้อนหาไม่เจอเลยถ้าเกิดกับลูกค้าจริง
 * ปิดช่องนี้ด้วยโครงสร้างจึงคุ้มกว่าปล่อยไว้แล้วหวังว่าจะไม่มีใครกดทัน
 *
 * state มีไว้ให้หน้าจอวาด · ref มีไว้ให้ปุ่มอ่าน — ref ไม่ขึ้นกับจังหวะ render
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
interface Form {
  levels: Record<Priority, { respond: number; resolve: number }>;
  countBusinessHours: boolean;
  pauseOnCustomer: boolean;
  pauseOnVendor: boolean;
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

  const [form, setFormState] = useState<Form>({
    levels: {
      low: { respond: 0, resolve: 0 },
      medium: { respond: 0, resolve: 0 },
      high: { respond: 0, resolve: 0 },
      critical: { respond: 0, resolve: 0 },
    },
    countBusinessHours: true,
    pauseOnCustomer: true,
    pauseOnVendor: true,
  });

  /**
   * เงาของฟอร์มที่ไม่ขึ้นกับจังหวะ render — `save()` อ่านจากตัวนี้เท่านั้น
   * เขียนพร้อมกับ state ทุกครั้งผ่าน `setForm()` ห้ามเรียก `setFormState` ตรงๆ ที่อื่น
   */
  const formRef = useRef(form);

  const setForm = useCallback((next: Form | ((cur: Form) => Form)) => {
    const value = typeof next === 'function' ? next(formRef.current) : next;
    formRef.current = value;
    setFormState(value);
  }, []);

  const apply = useCallback(
    (d: Data) => {
      setData(d);
      const merged: Form['levels'] = {
        low: { ...d.defaults.low },
        medium: { ...d.defaults.medium },
        high: { ...d.defaults.high },
        critical: { ...d.defaults.critical },
      };
      for (const l of d.policy?.levels ?? []) {
        merged[l.priority] = { respond: l.respondMinutes, resolve: l.resolveMinutes };
      }
      setForm({
        levels: merged,
        countBusinessHours: d.policy?.countBusinessHours ?? true,
        pauseOnCustomer: d.policy?.pauseOnCustomer ?? true,
        pauseOnVendor: d.policy?.pauseOnVendor ?? true,
      });
    },
    [setForm],
  );

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
      // อ่านจาก ref ไม่ใช่จาก state — state อาจยังเป็นค่าก่อนที่ผู้ใช้เพิ่งพิมพ์
      const r = await api.put<Data>(`/t/${tenant}/clients/${clientId}/contract`, formRef.current);
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
                    value={form.levels[l.priority].respond}
                    onChange={(e) => {
                      const respond = toInt(e.target.value);
                      setForm((f) => ({
                        ...f,
                        levels: {
                          ...f.levels,
                          [l.priority]: { ...f.levels[l.priority], respond },
                        },
                      }));
                    }}
                  />
                </td>
                <td>
                  <input
                    className="inp mn"
                    style={{ maxWidth: 150 }}
                    value={form.levels[l.priority].resolve}
                    onChange={(e) => {
                      const resolve = toInt(e.target.value);
                      setForm((f) => ({
                        ...f,
                        levels: {
                          ...f.levels,
                          [l.priority]: { ...f.levels[l.priority], resolve },
                        },
                      }));
                    }}
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
                checked={form.countBusinessHours}
                onChange={(e) => {
                  const v = e.target.checked;
                  setForm((f) => ({ ...f, countBusinessHours: v }));
                }}
              />
              <span>นับเฉพาะเวลาทำการของที่ทำงาน (ตั้งที่หน้าตั้งค่า)</span>
            </label>
            <label className="chkrow">
              <input
                type="checkbox"
                checked={form.pauseOnCustomer}
                onChange={(e) => {
                  const v = e.target.checked;
                  setForm((f) => ({ ...f, pauseOnCustomer: v }));
                }}
              />
              <span>หยุดนาฬิกาเมื่อรอลูกค้าตอบ</span>
            </label>
            <label className="chkrow">
              <input
                type="checkbox"
                checked={form.pauseOnVendor}
                onChange={(e) => {
                  const v = e.target.checked;
                  setForm((f) => ({ ...f, pauseOnVendor: v }));
                }}
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
