import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { columnIndexOf, columnNameOf, taskCode, toneOf } from '@/lib/types';
import { columnsOfProject, MEMBERS, memberById, TASKS, WARRANTY_TASKS } from '@/mock/data';

/**
 * หน้าจอ 20 · รายละเอียดทิกเก็ต  ·  39 · ทิกเก็ตงานประกัน (เมื่อรหัสขึ้นต้นด้วย TT)
 * ปุ่มการกระทำมีชื่อชัดเจน ไม่ใช่ dropdown เปลี่ยนสถานะ เพราะแต่ละการย้ายมีกติกาผูกอยู่
 * การตีกลับแสดงเป็นคอมเมนต์สีเหลือง ไม่ใช่บรรทัดระบบเล็กๆ เพราะมันคือข้อมูลที่ต้องอ่าน
 * บันทึกเวลา SLA เก็บเป็นช่วงๆ ไม่ใช่ยอดรวม เพื่อชี้ได้ว่าหยุดตอนไหนเพราะอะไร
 */
export default async function TicketPage({
  params,
}: {
  params: Promise<{ tenant: string; code: string }>;
}) {
  const { tenant, code } = await params;
  const warranty = code.startsWith('TT');
  const t = warranty
    ? (WARRANTY_TASKS.find((x) => taskCode(x) === code) ?? WARRANTY_TASKS[0])
    : (TASKS.find((x) => taskCode(x) === code) ?? TASKS[7]);
  if (!t) notFound();
  const assignee = memberById(t.assigneeId);
  const cols = columnsOfProject(warranty ? 'WEB' : 'ACM');
  const ci = columnIndexOf(t, cols);

  return (
    <>
      <MockNotice />
      <PageHead
        title={t.title}
        desc={`${code} · ${warranty ? 'งานประกัน · ทองไทย มีเดีย' : 'เว็บไซต์ Acme'}`}
        right={
          <>
            {/* ถอยหลัง = ตีกลับ ต้องใส่เหตุผลเสมอ */}
            <button type="button" className="btn btn-2 btn-sm" disabled={ci === 0}>
              ← ย้ายกลับ “{cols[ci - 1]?.name ?? ''}”
            </button>
            {ci < cols.length - 1 ? (
              <button type="button" className="btn btn-pri btn-sm">
                ย้ายไป “{cols[ci + 1]?.name}” →
              </button>
            ) : null}
          </>
        }
      />

      <div className="tk-grid">
        <div>
          <Card className="mb">
            <div className="card-b">
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                {warranty
                  ? 'ลูกค้าแจ้งว่าฟอร์มติดต่อกดส่งแล้วไม่มีอีเมลเข้ามาที่กล่องของฝ่ายขาย ตรวจแล้วพบว่าโดเมนผู้ส่งหมดอายุ SPF'
                  : 'ใส่คูปองสองใบพร้อมกันแล้วส่วนลดถูกคำนวณซ้อนกัน ทำให้ยอดสุทธิติดลบในบางกรณี'}
              </p>
            </div>
          </Card>

          {/* คอมเมนต์ตีกลับต้องเด่น เพราะเป็นข้อมูลที่ต้องอ่าน */}
          <Card className="mb">
            <div className="card-h">
              <b>ความเคลื่อนไหว</b>
            </div>
            <div className="card-b" style={{ display: 'grid', gap: 12 }}>
              <div className="cmt cmt-reject">
                <div className="cmt-h">
                  <Avatar member={MEMBERS[0]} size="sm" />
                  <b>พีรพล ว.</b>
                  <span className="sub">ตีกลับ · วันนี้ 10:24</span>
                </div>
                <p>ยังคำนวณส่วนลดซ้อนกันอยู่ตอนใส่คูปองสองใบ ลองเคสนี้ก่อนส่งใหม่</p>
              </div>
              <div className="cmt">
                <div className="cmt-h">
                  <Avatar member={MEMBERS[1]} size="sm" />
                  <b>ณัฐกิตติ์ ส.</b>
                  <span className="sub">เมื่อวาน 16:40</span>
                </div>
                <p>แก้สูตรคิดส่วนลดแล้ว รอตรวจครับ</p>
              </div>
              <div className="sysline">ย้ายจาก “กำลังทำ” ไป “รอตรวจ” · เมื่อวาน 16:38</div>
            </div>
          </Card>

          <Card>
            <div className="card-h">
              <b>เขียนคอมเมนต์</b>
            </div>
            <div className="card-b">
              <textarea className="inp" rows={3} placeholder="พิมพ์ข้อความ… ใช้ @ เพื่อเรียกคน" />
              {warranty ? (
                <div className="alert w" style={{ marginTop: 10 }}>
                  <span>⚠</span>
                  <div>
                    <b>ลูกค้าเห็นอะไรบ้าง</b> — คอมเมนต์นี้เป็นบันทึกภายใน ลูกค้าเห็นเฉพาะขั้นตอนในไทม์ไลน์
                    ไม่เห็นข้อความนี้ ไม่เห็นชื่อผู้รับผิดชอบ และไม่เห็นตัวเลข SLA
                  </div>
                </div>
              ) : null}
              <button type="button" className="btn btn-pri btn-sm" style={{ marginTop: 10 }}>
                ส่งคอมเมนต์
              </button>
            </div>
          </Card>
        </div>

        <div>
          <Card className="mb">
            <div className="card-b">
              <div className="kv">
                <span>อยู่คอลัมน์</span>
                <span className={`chip st-${toneOf(t, cols)}`}>{columnNameOf(t, cols)}</span>
              </div>
              <div className="kv">
                <span>ผู้รับผิดชอบ</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Avatar member={assignee} size="sm" />
                  {assignee?.name ?? 'ยังไม่กำหนด'}
                </span>
              </div>
              <div className="kv">
                <span>ความสำคัญ</span>
                <span className={`pr pr-${t.priority}`}>
                  {t.priority === 'critical'
                    ? 'วิกฤต'
                    : t.priority === 'high'
                      ? 'สูง'
                      : t.priority === 'medium'
                        ? 'กลาง'
                        : 'ต่ำ'}
                </span>
              </div>
              <div className="kv">
                <span>ถือมา</span>
                <b className="mn">{t.heldDays} วัน</b>
              </div>
              {t.dueDate ? (
                <div className="kv">
                  <span>กำหนดส่ง</span>
                  <b className="mn">{t.dueDate}</b>
                </div>
              ) : null}
            </div>
          </Card>

          {warranty ? (
            <Card className="mb">
              <div className="card-h">
                <b>นาฬิกา SLA</b>
              </div>
              <div className="card-b">
                <div className="kv">
                  <span>ผลคัดแยก</span>
                  <span className="chip st-done">อยู่ในประกัน</span>
                </div>
                <div className="kv">
                  <span>สถานะนาฬิกา</span>
                  <span className="chip st-doing">กำลังเดิน</span>
                </div>
                <div className="kv">
                  <span>ใช้ไปแล้ว</span>
                  <b className="mn txt-danger">เกินมา 3 ชม.</b>
                </div>
                <div className="clocklog">
                  <div>เริ่มเดิน · 18 ส.ค. 09:12</div>
                  <div>หยุด — นอกเวลาทำการ · 18 ส.ค. 18:00</div>
                  <div>เดินต่อ · 19 ส.ค. 09:00</div>
                  <div>หยุด — รอลูกค้ายืนยัน · 19 ส.ค. 11:30</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-2 btn-sm">
                    หยุด — รอลูกค้า
                  </button>
                  <button type="button" className="btn btn-2 btn-sm">
                    หยุด — รอผู้ให้บริการ
                  </button>
                </div>
                <div className="hint" style={{ marginTop: 8 }}>
                  เก็บเป็นช่วงๆ ไม่ใช่ยอดรวม เวลาลูกค้าถามว่าทำไมช้าจะชี้ได้ว่าหยุดตอนไหนเพราะอะไร
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <div className="card-h">
              <b>ไฟล์แนบ</b>
            </div>
            <div className="empty">ยังไม่มีไฟล์แนบ</div>
          </Card>
          <p className="hint" style={{ marginTop: 10 }}>
            <Link href={`/${tenant}/projects/ACM/board`} className="auth-link">
              ← กลับไปบอร์ด
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
