import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { SLA_LEVELS, clientById } from '@/mock/data';

/**
 * หน้าจอ 34 · สัญญาและนโยบาย SLA
 * ตารางระดับความสำคัญกรอกได้เอง เพราะสัญญาแต่ละฉบับไม่เหมือนกัน แต่จำนวนระดับคงที่ 4
 * กติกาการนับเวลาเป็นเช็กบ็อกซ์ ไม่ใช่ข้อความอิสระ เพื่อให้ระบบคำนวณได้จริง
 * sla_policies เก็บเป็นเวอร์ชัน · ทิกเก็ตอ้าง policy_version_id ตอนสร้าง ไม่อ่านค่าปัจจุบัน
 */
export default async function ContractPage({
  params,
}: { params: Promise<{ tenant: string; id: string }> }) {
  const { id } = await params;
  const c = clientById(id);
  if (!c) notFound();
  return (
    <>
      <MockNotice />
      <PageHead title="สัญญาและนโยบาย SLA" desc={`${c.name} · ${c.contractLevel ?? 'ยังไม่มีสัญญา'}`}
                right={<button type="button" className="btn btn-pri btn-sm">บันทึกเป็นเวอร์ชันใหม่</button>} />
      <Card className="mb">
        <div className="card-h"><b>ระดับความสำคัญ</b>
          <div className="r"><span className="sub">คงที่ 4 ระดับ</span></div></div>
        <table className="tbl">
          <thead><tr><th>ระดับ</th><th>ความหมาย</th><th>ตอบกลับภายใน</th><th>แก้เสร็จภายใน</th></tr></thead>
          <tbody>
            {SLA_LEVELS.map((l) => (
              <tr key={l.name}>
                <td><span className="chip">{l.name}</span></td>
                <td className="sub">{l.desc}</td>
                <td><input className="inp mn" defaultValue={l.respond} style={{ maxWidth: 130 }} /></td>
                <td><input className="inp mn" defaultValue={l.resolve} style={{ maxWidth: 150 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid2">
        <Card>
          <div className="card-h"><b>กติกาการนับเวลา</b></div>
          <div className="card-b">
            <label className="chkrow"><input type="checkbox" defaultChecked />
              <span>นับเฉพาะเวลาทำการ (จ–ศ 09:00–18:00)</span></label>
            <label className="chkrow"><input type="checkbox" defaultChecked />
              <span>ข้ามวันหยุดราชการไทย</span></label>
            <label className="chkrow"><input type="checkbox" defaultChecked />
              <span>หยุดนาฬิกาเมื่อรอลูกค้าตอบ</span></label>
            <label className="chkrow"><input type="checkbox" defaultChecked />
              <span>หยุดนาฬิกาเมื่อรอผู้ให้บริการภายนอก</span></label>
            <div className="hint" style={{ marginTop: 8 }}>
              เป็นเช็กบ็อกซ์ ไม่ใช่ข้อความอิสระ เพราะระบบต้องคำนวณได้จริง</div>
          </div>
        </Card>
        <Card>
          <div className="card-h"><b>ช่วงเวลาสัญญา</b></div>
          <div className="card-b">
            <div className="kv"><span>เริ่ม</span><b className="mn">14 พ.ค. 2569</b></div>
            <div className="kv"><span>สิ้นสุด</span><b className="mn">14 พ.ค. 2570</b></div>
            <div className="kv"><span>เวอร์ชันนโยบาย</span><b className="mn">v2</b></div>
            <div className="alert w" style={{ marginTop: 12 }}>
              <span>⚠</span><div>แก้นโยบายแล้ว<b>ไม่มีผลย้อนหลัง</b> —
                เรื่องที่เปิดไปแล้วยังใช้เงื่อนไขเวอร์ชันเดิมจนกว่าจะปิด</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
