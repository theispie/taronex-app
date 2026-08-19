import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { CLIENTS, MEMBERS, columnsOfProject, projectByKey } from '@/mock/data';

/**
 * หน้าจอ 12 · แก้ไขโปรเจกต์
 * รหัสย่อเปลี่ยนภายหลังไม่ได้ เพราะรหัสการ์ดเก่าจะกำพร้า
 * คอลัมน์แก้ที่นี่ได้ แต่แก้แล้วกระทบเฉพาะโปรเจกต์นี้ ไม่ย้อนไปที่แม่แบบ
 */
export default async function EditProjectPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  const cols = columnsOfProject(key);

  return (
    <>
      <MockNotice />
      <PageHead title="แก้ไขโปรเจกต์" desc={`${p.key} · ${p.name}`} />
      <div style={{ maxWidth: 640 }}>
        <Card className="mb"><div className="card-b">
          <div className="fld"><label className="lbl" htmlFor="pn">ชื่อโปรเจกต์</label>
            <input id="pn" className="inp" defaultValue={p.name} /></div>

          <div className="row2">
            <div className="fld"><label className="lbl" htmlFor="pk">รหัสย่อ</label>
              <input id="pk" className="inp mn" defaultValue={p.key} readOnly
                     style={{ background: 'var(--surface-2)', color: 'var(--muted)' }} />
              <div className="hint">เปลี่ยนไม่ได้ เพราะรหัสการ์ดเก่า ({p.key}-138) จะกำพร้า</div></div>
            <div className="fld"><label className="lbl" htmlFor="pc">ลูกค้า</label>
              <select id="pc" className="inp" defaultValue={p.clientName}>
                {CLIENTS.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select></div>
          </div>

          <div className="fld" style={{ marginBottom: 0 }}>
            <label className="lbl" htmlFor="pm">PM ของโปรเจกต์</label>
            <select id="pm" className="inp" defaultValue={p.pmUserId}>
              {MEMBERS.filter((m) => m.role !== 'guest' && m.role !== 'viewer')
                .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <div className="hint">เปลี่ยนได้เฉพาะเจ้าของที่ทำงานหรือ PM คนปัจจุบัน</div></div>
        </div></Card>

        <Card className="mb">
          <div className="card-h"><b>คอลัมน์บนบอร์ด</b>
            <div className="r"><span className="sub">{cols.length} คอลัมน์</span>
              <button type="button" className="btn btn-2 btn-sm">＋ เพิ่มคอลัมน์</button></div></div>
          <div className="card-b">
            {cols.map((c) => (
              <div key={c.key} className="colrow2">
                <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
                <span />
                <input className="inp" defaultValue={c.name} />
                <button type="button" className="btn btn-sm btn-gh"
                        disabled={cols.length <= 2}>ลบ</button>
              </div>
            ))}
            <div className="alert w" style={{ marginTop: 12 }}>
              <span>⚠</span>
              <div>ลบคอลัมน์ที่ยังมีการ์ดอยู่ไม่ได้ — ต้องย้ายการ์ดออกก่อน</div>
            </div>
          </div>
        </Card>

        <Card className="mb"><div className="card-b">
          <div className="fld" style={{ marginBottom: 0 }}>
            <span className="lbl">ชื่อประเภทงาน</span>
            <div className="row3">{p.typeLabels.map((x, i) =>
              <input key={i} className="inp" defaultValue={x} />)}</div></div>
        </div></Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-pri">บันทึก</button>
          <Link href={`/${tenant}/projects/${key}`} className="btn btn-2">ยกเลิก</Link>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-dn">ปิดโปรเจกต์</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          ปิดโปรเจกต์ = <code>is_archived</code> ไม่ลบข้อมูล และคืนโควตาทันที
        </p>
      </div>
    </>
  );
}
