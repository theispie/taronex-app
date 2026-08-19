import Link from 'next/link';

/**
 * หน้าจอ 06 · ทางเข้าลูกค้า (ไม่ใช้รหัสผ่าน)
 * ไม่มีโลโก้หรือชื่อ TaroNex ทั้งหน้า — ลูกค้าเห็นแต่แบรนด์ของเอเจนซี่
 * ไม่ใช้รหัสผ่าน เพราะคนของลูกค้าเข้าปีละไม่กี่ครั้ง ตั้งรหัสไปก็ลืม
 * อีเมลต้องอยู่ในตาราง client_contacts ของลูกค้ารายนั้นเท่านั้น · โทเคนใช้ครั้งเดียว อายุ 24 ชม.
 */
export default async function PortalLogin({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="auth-wrap" style={{ background: '#F7FAFA' }}>
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark ws">DX</span><b>ดิจิทัลเอ็กซ์ จำกัด</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>เข้าดูเรื่องที่แจ้งไว้</h1>
        <p className="sub" style={{ marginBottom: 20 }}>ไม่ต้องใช้รหัสผ่าน</p>

        <div className="pw-card">
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="pe">อีเมลของคุณ</label>
              <input id="pe" className="inp mn" type="email" placeholder="somying@thongthai.co.th" />
              <div className="hint">ใช้อีเมลที่ทีมงานลงทะเบียนไว้ให้</div>
            </div>
            <Link href={`/portal/${slug}`} className="btn btn-ws btn-bl btn-lg">
              ส่งลิงก์เข้าใช้งาน
            </Link>
            <p className="hint" style={{ marginTop: 12, textAlign: 'center' }}>
              ลิงก์ใช้ได้ครั้งเดียว มีอายุ 24 ชั่วโมง
            </p>
          </div>
        </div>

        <p className="auth-foot">
          อีเมลไม่มา? โทร <b className="mn">02-123-4567</b> ในเวลาทำการ
        </p>
      </div>
    </div>
  );
}
