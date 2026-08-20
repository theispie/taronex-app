import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { PROJECTS, columnsOfProject } from '@/mock/data';

/**
 * บันทึกโปรเจกต์เป็นแม่แบบ — ส่วนหนึ่งของหน้าจอ 40 (M9)
 * ตัดชื่อคน วันจริง และไฟล์ออกทั้งหมด เหลือแต่โครงงาน
 * วันที่ในแม่แบบเป็นวันสัมพัทธ์ (+N วันจากวันเริ่ม) จึงใช้ซ้ำได้ทุกโปรเจกต์
 */
export default async function NewTemplatePage({
  params,
}: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const src = PROJECTS[0];
  if (!src) notFound();
  const cols = columnsOfProject(src.key);
  return (
    <>
      <MockNotice />
      <PageHead title="บันทึกโปรเจกต์เป็นแม่แบบ" />
      <div style={{ maxWidth: 620 }}>
        <Card className="mb"><div className="card-b">
          <div className="fld"><label className="lbl" htmlFor="src">เอาโครงจากโปรเจกต์</label>
            <select id="src" className="inp">
              {PROJECTS.map((p) => <option key={p.id} value={p.key}>{p.key} · {p.name}</option>)}
            </select></div>
          <div className="fld" style={{ marginBottom: 0 }}>
            <label className="lbl" htmlFor="tnm">ตั้งชื่อแม่แบบ</label>
            <input id="tnm" className="inp" defaultValue={`${src.name} (แม่แบบ)`} /></div>
        </div></Card>

        <Card className="mb">
          <div className="card-h"><b>สิ่งที่จะถูกคัดลอกไป</b></div>
          <div className="card-b">
            <div className="seen"><span className="ok">✓</span>
              คอลัมน์ {cols.length} อัน · {cols.map((c) => c.name).join(' → ')}</div>
            <div className="seen"><span className="ok">✓</span>
              งานหลัก {src.features.length} ก้อน · {src.features.map((f) => f.name).join(' · ')}</div>
            <div className="seen"><span className="ok">✓</span>ชื่อประเภทงาน · {src.typeLabels.join(' / ')}</div>
            <div className="seen"><span className="ok">✓</span>ชื่อการ์ด และวันที่แบบสัมพัทธ์</div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h"><b>สิ่งที่จะถูกตัดออก</b></div>
          <div className="card-b">
            <div className="seen"><span className="no">✕</span>ชื่อผู้รับผิดชอบทุกใบ</div>
            <div className="seen"><span className="no">✕</span>วันที่จริง — แปลงเป็น “+N วันจากวันเริ่ม”</div>
            <div className="seen"><span className="no">✕</span>ไฟล์แนบและคอมเมนต์</div>
            <div className="seen"><span className="no">✕</span>ชื่อลูกค้าและงานประกันทั้งหมด</div>
            <div className="hint" style={{ marginTop: 8 }}>
              แม่แบบต้องไม่มีข้อมูลของลูกค้ารายไหนติดไป เพราะเอาไปใช้กับลูกค้ารายอื่น</div>
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-pri">บันทึกเป็นแม่แบบ</button>
          <Link href={`/${tenant}/templates`} className="btn btn-2">ยกเลิก</Link>
        </div>
      </div>
    </>
  );
}
