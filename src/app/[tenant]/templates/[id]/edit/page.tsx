import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { templateById } from '@/mock/data';
import { STATUS_MEANING, TASK_STATUSES, validateColumns } from '@/lib/types';
import type { BoardColumn } from '@/lib/types';

/**
 * หน้าจอ 41 · สร้าง / แก้ไขแม่แบบ
 *
 * คอลัมน์บนบอร์ดกำหนดที่นี่ — จำนวนเท่าไรก็ได้ (2–8)
 * แต่ทุกคอลัมน์ต้องเลือกว่าตัวเองแปลว่าอะไรใน 4 ความหมายที่ระบบรู้จัก
 * เพราะระบบต้องตอบให้ได้ว่า "การ์ดใบนี้ปิดแล้วหรือยัง" และ "ต้องมีคนตรวจไหม"
 * ถ้าไม่มีการแปลนี้ ของที่พังตามคือ: ใครปิดการ์ดได้ · นาฬิกา SLA · ขั้นที่ลูกค้าเห็นในพอร์ทัล ·
 * เปอร์เซ็นต์ความคืบหน้า · การเทียบตัวเลขข้ามโปรเจกต์
 *
 * การ์ดตั้งต้นใช้วันสัมพัทธ์ (+N วันจากวันเริ่ม) ไม่ใช่วันจริง จึงใช้ซ้ำได้ทุกโปรเจกต์
 * แก้แม่แบบแล้วโปรเจกต์เก่าไม่เปลี่ยน เพราะโปรเจกต์คัดลอกชุดคอลัมน์ไปตอนสร้าง
 */
const DEFAULT_COLS: BoardColumn[] = [
  { key: 'todo', name: 'รอทำ', mapsTo: 'todo' },
  { key: 'doing', name: 'กำลังทำ', mapsTo: 'doing' },
  { key: 'review', name: 'รอตรวจ', mapsTo: 'review' },
  { key: 'done', name: 'เสร็จ', mapsTo: 'done' },
];

export default async function TemplateEditPage({
  params,
}: { params: Promise<{ tenant: string; id: string }> }) {
  const { id } = await params;
  const t = templateById(id);
  if (!t) notFound();
  const cols = t.board ?? DEFAULT_COLS;
  const errs = validateColumns(cols);
  const flow = [...new Set(cols.map((c) => STATUS_MEANING[c.mapsTo]))];

  return (
    <>
      <MockNotice />
      <PageHead title={`แม่แบบ: ${t.name}`}
                right={<button type="button" className="btn btn-pri btn-sm">บันทึก</button>} />
      <div style={{ maxWidth: 760 }}>
        <Card className="mb">
          <div className="card-b">
            <div className="fld" style={{ marginBottom: 0 }}>
              <label className="lbl" htmlFor="tn">ชื่อแม่แบบ</label>
              <input id="tn" className="inp" defaultValue={t.name} />
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h">
            <b>คอลัมน์บนบอร์ด</b>
            <div className="r">
              <span className="sub">{cols.length} คอลัมน์</span>
              <button type="button" className="btn btn-2 btn-sm">＋ เพิ่มคอลัมน์</button>
            </div>
          </div>
          <div className="card-b">
            <div className="colhead">
              <span />
              <span className="lbl" style={{ margin: 0 }}>ชื่อที่คนเห็นบนบอร์ด</span>
              <span className="lbl" style={{ margin: 0 }}>ระบบเข้าใจว่าคืออะไร</span>
              <span />
            </div>
            {cols.map((c) => (
              <div key={c.key} className="colrow">
                <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
                <input className="inp" defaultValue={c.name} />
                <select className="inp" defaultValue={c.mapsTo}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_MEANING[s]}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm btn-gh"
                        disabled={cols.length <= 2}>ลบ</button>
              </div>
            ))}

            <div className={errs.length ? 'alert d' : 'alert o'} style={{ marginTop: 14 }}>
              <span>{errs.length ? '✕' : '✓'}</span>
              <div>
                {errs.length ? (
                  <>ยังบันทึกไม่ได้<ul style={{ margin: '6px 0 0 16px' }}>
                    {errs.map((e) => <li key={e}>{e}</li>)}</ul></>
                ) : (
                  <>ชุดคอลัมน์นี้ใช้ได้ · ระบบจะมองว่างานไหลแบบ <b>{flow.join(' → ')}</b></>
                )}
              </div>
            </div>

            <div className="alert i" style={{ marginTop: 10 }}>
              <span>ℹ</span>
              <div>
                <b>ทำไมต้องเลือกความหมาย</b> — คอลัมน์กี่อันก็ได้ แต่ระบบต้องตอบให้ได้ว่า
                การ์ดใบนี้ “ปิดแล้วหรือยัง” และ “ต้องมีคนตรวจไหม” ไม่งั้นสิ่งเหล่านี้ทำงานไม่ได้:
                <br />กติกาที่ให้ PM เท่านั้นปิดการ์ด · นาฬิกา SLA หยุดตอนไหน ·
                ขั้นที่ลูกค้าเห็นในพอร์ทัล · เปอร์เซ็นต์ความคืบหน้าบน Timeline ·
                การเทียบตัวเลขข้ามโปรเจกต์
              </div>
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h"><b>ตัวอย่างบอร์ดที่จะได้</b></div>
          <div className="card-b">
            <div className="bd bd-scroll">
              {cols.map((c) => (
                <section key={c.key} className="bcol" style={{ minWidth: 150, flex: '0 0 150px' }}>
                  <div className="h">
                    <span className={`sw st-${c.mapsTo}`} style={{ background: 'currentColor' }} />
                    <b style={{ fontSize: 12 }}>{c.name}</b>
                  </div>
                  <div className="colmap" style={{ display: 'inline-block' }}>
                    {STATUS_MEANING[c.mapsTo]}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-b">
            <div className="fld" style={{ marginBottom: 0 }}>
              <span className="lbl">ประเภทงาน (สูงสุด 3)</span>
              <div className="row3">{[0, 1, 2].map((i) =>
                <input key={i} className="inp" defaultValue={t.types[i] ?? ''} />)}</div>
              <div className="hint">คำว่า “บั๊ก” ใช้ไม่ได้กับงาน HR หรือการตลาด จึงตั้งชื่อเองได้</div>
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h"><b>งานหลักตั้งต้น</b>
            <div className="r"><button type="button" className="btn btn-2 btn-sm">＋ เพิ่ม</button></div></div>
          {t.features.map((f, i) => (
            <div key={f} className="row">
              <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
              <span className="row-title">{f}</span>
              <span className="sub mn">+{i * 5} วันจากวันเริ่ม</span>
            </div>
          ))}
          {t.features.length === 0 ? <div className="empty">แม่แบบนี้เริ่มจากบอร์ดเปล่า</div> : null}
        </Card>

        <div className="alert w">
          <span>⚠</span>
          <div>แก้แม่แบบแล้ว<b>ไม่กระทบโปรเจกต์ที่สร้างไปแล้ว</b> —
            โปรเจกต์คัดลอกชุดคอลัมน์ไปเป็นของตัวเองตอนสร้าง</div>
        </div>
      </div>
    </>
  );
}
