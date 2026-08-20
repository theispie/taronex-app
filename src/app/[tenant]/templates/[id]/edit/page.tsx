import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import type { BoardColumn } from '@/lib/types';
import { columnTone, validateColumns } from '@/lib/types';
import { templateById } from '@/mock/data';

/**
 * หน้าจอ 41 · สร้าง / แก้ไขแม่แบบ
 *
 * คอลัมน์มีแค่ชื่อ — ไม่มีธง ไม่มี dropdown ไม่มีอะไรให้ตั้งค่า
 * คนสร้างแม่แบบพิมพ์ชื่อคอลัมน์กับจัดลำดับเท่านั้น
 *
 * กติกาทั้งหมดอ่านจากลำดับและทิศทางการลาก:
 *   คอลัมน์แรก    = การ์ดใหม่มาลงที่นี่
 *   คอลัมน์สุดท้าย = ปิดงาน · PM เท่านั้นที่ลากมาได้ · นาฬิกา SLA หยุด
 *   ลากถอยหลัง    = ตีกลับ ต้องใส่เหตุผล
 *
 * การ์ดตั้งต้นใช้วันสัมพัทธ์ (+N วันจากวันเริ่ม) จึงใช้ซ้ำได้ทุกโปรเจกต์
 * แก้แม่แบบแล้วโปรเจกต์เก่าไม่เปลี่ยน เพราะโปรเจกต์คัดลอกชุดคอลัมน์ไปตอนสร้าง
 */
const DEFAULT_COLS: BoardColumn[] = [
  { key: 'todo', name: 'รอทำ' },
  { key: 'doing', name: 'กำลังทำ' },
  { key: 'review', name: 'รอตรวจ' },
  { key: 'done', name: 'เสร็จ' },
];

export default async function TemplateEditPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { id } = await params;
  const t = templateById(id);
  if (!t) notFound();
  const cols = t.board ?? DEFAULT_COLS;
  const errs = validateColumns(cols);

  return (
    <>
      <MockNotice />
      <PageHead
        title={`แม่แบบ: ${t.name}`}
        right={
          <button type="button" className="btn btn-pri btn-sm">
            บันทึก
          </button>
        }
      />
      <div style={{ maxWidth: 760 }}>
        <Card className="mb">
          <div className="card-b">
            <div className="fld" style={{ marginBottom: 0 }}>
              <label className="lbl" htmlFor="tn">
                ชื่อแม่แบบ
              </label>
              <input id="tn" className="inp" defaultValue={t.name} />
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h">
            <b>คอลัมน์บนบอร์ด</b>
            <div className="r">
              <span className="sub">{cols.length} คอลัมน์</span>
              <button type="button" className="btn btn-2 btn-sm">
                ＋ เพิ่มคอลัมน์
              </button>
            </div>
          </div>
          <div className="card-b">
            <p className="sub" style={{ marginBottom: 12 }}>
              พิมพ์ชื่อที่อยากได้แล้วลากจัดลำดับ — ไม่ต้องตั้งค่าอะไรเพิ่ม
            </p>

            {cols.map((c, i) => (
              <div key={c.key} className="colrow2">
                <span style={{ color: 'var(--faint)', cursor: 'grab' }}>⠿</span>
                <span
                  className={`sw st-${columnTone(i, cols.length)}`}
                  style={{ background: 'currentColor' }}
                />
                <input className="inp" defaultValue={c.name} />
                <button type="button" className="btn btn-sm btn-gh" disabled={cols.length <= 2}>
                  ลบ
                </button>
              </div>
            ))}

            {errs.length ? (
              <div className="alert d" style={{ marginTop: 14 }}>
                <span>✕</span>
                <div>
                  ยังบันทึกไม่ได้
                  <ul style={{ margin: '6px 0 0 16px' }}>
                    {errs.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="alert o" style={{ marginTop: 14 }}>
                <span>✓</span>
                <div>
                  ใช้ได้ · การ์ดใหม่ลง <b>{cols[0]?.name}</b> · ลากถึง{' '}
                  <b>{cols[cols.length - 1]?.name}</b> ถือว่าปิดงาน
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h">
            <b>บอร์ดที่จะได้</b>
          </div>
          <div className="card-b">
            <div className="bd bd-scroll">
              {cols.map((c, i) => (
                <section key={c.key} className="bcol" style={{ minWidth: 140, flex: '0 0 140px' }}>
                  <div className="h">
                    <span
                      className={`sw st-${columnTone(i, cols.length)}`}
                      style={{ background: 'currentColor' }}
                    />
                    <b style={{ fontSize: 12 }}>{c.name}</b>
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
              <div className="row3">
                {[0, 1, 2].map((i) => (
                  <input key={i} className="inp" defaultValue={t.types[i] ?? ''} />
                ))}
              </div>
              <div className="hint">คำว่า “บั๊ก” ใช้ไม่ได้กับงาน HR หรือการตลาด จึงตั้งชื่อเองได้</div>
            </div>
          </div>
        </Card>

        <Card className="mb">
          <div className="card-h">
            <b>งานหลักตั้งต้น</b>
            <div className="r">
              <button type="button" className="btn btn-2 btn-sm">
                ＋ เพิ่ม
              </button>
            </div>
          </div>
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
          <div>
            แก้แม่แบบแล้ว<b>ไม่กระทบโปรเจกต์ที่สร้างไปแล้ว</b> — โปรเจกต์คัดลอกชุดคอลัมน์ไปเป็นของตัวเองตอนสร้าง
          </div>
        </div>
      </div>
    </>
  );
}
