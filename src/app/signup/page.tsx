import Link from 'next/link';

/**
 * หน้าจอ 01 · สมัครใช้งาน
 * สมัคร 1 ครั้ง = สร้าง tenant ใหม่ทันที ไม่มีขั้น "เลือกแผน" มาขวาง
 * ชื่อบริษัทกรอกก่อนชื่อคน เพราะคนที่สมัครคือเจ้าของ ไม่ใช่พนักงาน
 */
export default function SignupPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>
          สร้างที่ทำงานใหม่
        </h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          ทดลองฟรี 14 วัน ไม่ต้องใส่บัตร
        </p>

        <div className="card">
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="co">
                ชื่อบริษัท / ทีม
              </label>
              <input id="co" className="inp" defaultValue="ดิจิทัลเอ็กซ์ จำกัด" />
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="addr">
                ที่อยู่ที่ทำงาน
              </label>
              <div className="addr-group">
                <span className="addr-prefix mn">taronex.theerawut.com/app/</span>
                <input
                  id="addr"
                  className="inp mn addr-input"
                  defaultValue="k7m2xq9btr4v"
                  readOnly
                />
              </div>
              <div className="hint">ระบบสุ่มรหัสให้อัตโนมัติ · ตั้งชื่อเองได้ในเวอร์ชันถัดไป</div>
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="nm">
                ชื่อของคุณ
              </label>
              <input id="nm" className="inp" defaultValue="พีรพล วงศ์สถาพร" />
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="em">
                อีเมลที่ทำงาน
              </label>
              <input
                id="em"
                className="inp mn"
                type="email"
                defaultValue="peerapon@digitalx.co.th"
              />
            </div>
            <div className="fld" style={{ marginBottom: 16 }}>
              <label className="lbl" htmlFor="pw2">
                รหัสผ่าน
              </label>
              <input id="pw2" className="inp" type="password" defaultValue="············" />
              <div className="pwmeter">
                <span className="on" />
                <span className="on" />
                <span className="on" />
                <span />
              </div>
              <div className="hint">อย่างน้อย 10 ตัวอักษร</div>
            </div>
            <Link href="/workspaces" className="btn btn-pri btn-bl btn-lg">
              สร้างที่ทำงาน
            </Link>
            <p className="auth-terms">การสร้างบัญชีถือว่ายอมรับเงื่อนไขการใช้งาน</p>
          </div>
        </div>

        <p className="auth-foot">
          มีบัญชีแล้ว?{' '}
          <Link href="/" className="auth-link">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  );
}
