import Link from 'next/link';

/**
 * หน้าจอ 04 · ตั้งรหัสผ่านใหม่
 * วัดความแข็งแรงแบบให้คำแนะนำ ไม่บล็อก — บล็อกแล้วคนจะตั้งรหัสที่จำง่ายกว่าเดิม
 * บอกผลข้างเคียง (ถูกออกจากระบบทุกเครื่อง) ก่อนกด ไม่ใช่หลังกด
 */
export default function ResetPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark ws">DX</span>
          <b>ดิจิทัลเอ็กซ์ จำกัด</b>
        </div>
        <h1 className="auth-h1">ตั้งรหัสผ่านใหม่</h1>
        <div className="card">
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="np">
                รหัสผ่านใหม่
              </label>
              <input id="np" className="inp" type="password" defaultValue="············" />
              <div className="pwmeter">
                <span className="on" />
                <span className="on" />
                <span className="on" />
                <span />
              </div>
              <div className="hint">อย่างน้อย 10 ตัวอักษร · ยิ่งยาวยิ่งดีกว่าใส่อักขระพิเศษ</div>
            </div>
            <div className="fld" style={{ marginBottom: 16 }}>
              <label className="lbl" htmlFor="np2">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input id="np2" className="inp" type="password" defaultValue="············" />
            </div>
            <div className="alert w" style={{ marginBottom: 14 }}>
              <span>⚠</span>
              <div>ตั้งรหัสใหม่แล้วคุณจะถูกออกจากระบบทุกเครื่องที่เคยเข้าไว้</div>
            </div>
            <Link href="/" className="btn btn-pri btn-bl btn-lg">
              ตั้งรหัสผ่านใหม่
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
