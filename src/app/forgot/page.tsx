import Link from 'next/link';

/**
 * หน้าจอ 03 · ลืมรหัสผ่าน
 * ข้อความยืนยันไม่บอกว่าอีเมลนี้มีอยู่จริงหรือไม่ — กันการไล่เดาว่าใครเป็นสมาชิก
 */
export default function ForgotPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark ws">DX</span>
          <b>ดิจิทัลเอ็กซ์ จำกัด</b>
        </div>
        <h1 className="auth-h1">ลืมรหัสผ่าน</h1>
        <div className="card">
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="em3">
                อีเมลที่ใช้เข้าระบบ
              </label>
              <input id="em3" className="inp mn" type="email" placeholder="you@company.co.th" />
              <div className="hint">ลิงก์ตั้งรหัสใหม่มีอายุ 30 นาที</div>
            </div>
            <button type="button" className="btn btn-pri btn-bl btn-lg">
              ส่งลิงก์ตั้งรหัสใหม่
            </button>
          </div>
        </div>
        <p className="auth-foot">
          <Link href="/" className="auth-link">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
