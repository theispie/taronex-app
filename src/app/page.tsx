import Link from 'next/link';

/**
 * หน้าจอ 02 · เข้าสู่ระบบ — เป็นหน้าแรกของ /app
 * ยังไม่มี backend: ปุ่มพาไปหน้าเลือกที่ทำงานตรงๆ เพื่อให้เดินดูหน้าจอได้
 */
export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand">
          <span className="mark ws">DX</span>
          <b>ดิจิทัลเอ็กซ์ จำกัด</b>
        </div>
        <h1 className="auth-h1">เข้าสู่ระบบ</h1>

        <div className="card">
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="email">
                อีเมล
              </label>
              <input
                id="email"
                className="inp mn"
                type="email"
                defaultValue="peerapon@digitalx.co.th"
              />
            </div>
            <div className="fld" style={{ marginBottom: 8 }}>
              <label className="lbl" htmlFor="pw">
                รหัสผ่าน
              </label>
              <input id="pw" className="inp" type="password" defaultValue="············" />
            </div>
            <div className="auth-row">
              <label className="auth-remember">
                <input type="checkbox" defaultChecked /> จำฉันไว้
              </label>
              <Link href="/forgot" className="auth-link">
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <Link href="/workspaces" className="btn btn-pri btn-bl btn-lg">
              เข้าสู่ระบบ
            </Link>
          </div>
        </div>

        <div className="alert i" style={{ marginTop: 16 }}>
          <span>ℹ</span>
          <div>เป็นลูกค้าที่ต้องการแจ้งปัญหา? ใช้ลิงก์ที่ได้รับทางอีเมล ไม่ต้องมีรหัสผ่าน</div>
        </div>

        <p className="auth-foot">
          ยังไม่มีที่ทำงาน?{' '}
          <Link href="/signup" className="auth-link">
            สร้างที่ทำงานใหม่
          </Link>
        </p>
      </div>
    </div>
  );
}
