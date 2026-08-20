import { Card, MockNotice, PageHead } from '@/components/ui';

/**
 * หน้าจอ 36 · โควตาเต็ม / ถูกระงับ
 * เสนอทางออกที่ไม่ต้องจ่ายเงินเป็นทางเลือกแรก และวางคู่กันในระดับเดียวกัน ไม่ซ่อน
 * บอกชัดว่าข้อมูลไม่ถูกลบในทุกกรณี — เป็นความกลัวอันดับหนึ่งของคนใช้ SaaS
 * "ปิดโปรเจกต์" ไม่ใช่ "ลบ" · ปิดแล้วโควตาคืนทันที
 */
export default function LimitsPage() {
  return (
    <>
      <MockNotice />
      <PageHead title="โควตาเต็ม" desc="เปิดโปรเจกต์ใหม่ไม่ได้จนกว่าจะจัดการอย่างใดอย่างหนึ่ง" />
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
            <div className="row" style={{ padding: '8px 0' }}>
              <span className="row-title">เว็บองค์กร ทองไทย</span>
              <span className="sub">ส่งมอบแล้ว</span>
              <button type="button" className="btn btn-sm btn-2">
                ปิดโปรเจกต์
              </button>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              ปิด ≠ ลบ — ข้อมูลยังอยู่ครบ
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>อัปเกรดแผน</b>
          </div>
          <div className="card-b">
            <p className="sub" style={{ marginBottom: 12 }}>
              แผนธุรกิจ เปิดได้ 30 โปรเจกต์ และที่นั่ง 50 คน
            </p>
            <div className="kv">
              <span>ตอนนี้</span>
              <b>ทีม · 10 โปรเจกต์</b>
            </div>
            <div className="kv">
              <span>อัปเกรดเป็น</span>
              <b>ธุรกิจ · 30 โปรเจกต์</b>
            </div>
            <button type="button" className="btn btn-pri" style={{ marginTop: 12 }}>
              ดูรายละเอียดแผน
            </button>
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
              <tr>
                <td>
                  <span className="chip st-done">ใช้งานอยู่</span>
                </td>
                <td className="sub">ชำระเงินปกติ</td>
                <td className="sub">ใช้ได้เต็มที่</td>
              </tr>
              <tr>
                <td>
                  <span className="chip st-doing">ค้างชำระ</span>
                </td>
                <td className="sub">เลยกำหนด 7 วัน</td>
                <td className="sub">อ่านได้ แก้ไม่ได้ · ข้อมูลอยู่ครบ</td>
              </tr>
              <tr>
                <td>
                  <span className="chip st-blocked">ถูกระงับ</span>
                </td>
                <td className="sub">เลยกำหนด 30 วัน</td>
                <td className="sub">
                  เข้าไม่ได้ชั่วคราว · <b>ข้อมูลยังอยู่ครบ</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
