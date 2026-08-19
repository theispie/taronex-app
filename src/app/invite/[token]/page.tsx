import Link from 'next/link';

/**
 * หน้าจอ 05 · รับคำเชิญเข้าทีม  (และ 44 · อีเมลไม่ตรง เมื่อ ?mismatch=1)
 * อีเมลล็อกไว้แก้ไม่ได้ เพราะคำเชิญผูกกับอีเมลนั้น
 * รับคำเชิญ "ห้ามสร้าง tenants ใหม่" — เข้าที่ทำงานที่มีอยู่แล้วเท่านั้น
 */
export default async function InvitePage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ mismatch?: string }>;
}) {
  const { token } = await params;
  const { mismatch } = await searchParams;

  if (mismatch) {
    return (
      <div className="auth-wrap">
        <div className="auth-box">
          <div className="auth-brand"><span className="mark">T</span><b>TaroNex</b></div>
          <h1 className="auth-h1">อีเมลไม่ตรงกับคำเชิญ</h1>
          <div className="card"><div className="card-b">
            <div className="cmp">
              <div><div className="lbl">คำเชิญนี้ส่งถึง</div>
                <div className="mn cmp-v">bee@digitalx.co.th</div></div>
              <div><div className="lbl">คุณกำลังเข้าใช้งานด้วย</div>
                <div className="mn cmp-v" style={{ color: 'var(--danger)' }}>peerapon@digitalx.co.th</div></div>
            </div>
            <p className="sub" style={{ margin: '14px 0' }}>
              บริษัทควบคุมสมาชิกผ่านอีเมลที่ตัวเองออกให้ คำเชิญจึงผูกกับอีเมลนั้นเท่านั้น
            </p>
            <Link href="/" className="btn btn-pri btn-bl">สลับไปเข้าใช้งานด้วย bee@digitalx.co.th</Link>
            <button type="button" className="btn btn-2 btn-bl" style={{ marginTop: 8 }}>
              ขอคำเชิญใหม่ไปที่อีเมลปัจจุบัน
            </button>
          </div></div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-box">
        <div className="auth-brand"><span className="mark">T</span><b>TaroNex</b></div>
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>คำเชิญเข้าร่วมทีม</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          <b>พีรพล ว.</b> เชิญคุณเข้าร่วม <b>ดิจิทัลเอ็กซ์ จำกัด</b>
        </p>
        <div className="card"><div className="card-b">
          <div className="fld">
            <label className="lbl" htmlFor="ie">อีเมล</label>
            <input id="ie" className="inp mn" defaultValue="bee@digitalx.co.th" readOnly
                   style={{ background: 'var(--surface-2)', color: 'var(--muted)' }} />
            <div className="hint">แก้ไม่ได้ เพราะคำเชิญผูกกับอีเมลนี้</div>
          </div>
          <div className="fld">
            <label className="lbl" htmlFor="inm">ชื่อของคุณ</label>
            <input id="inm" className="inp" placeholder="บุษบา รักษ์ดี" />
          </div>
          <div className="fld" style={{ marginBottom: 16 }}>
            <label className="lbl" htmlFor="ipw">ตั้งรหัสผ่าน</label>
            <input id="ipw" className="inp" type="password" />
          </div>
          <div className="kvbox">
            <div className="kv"><span>สิทธิ์ที่จะได้</span><b>สมาชิก</b></div>
            <div className="kv"><span>ตำแหน่งงาน</span><b>BA</b></div>
          </div>
          <Link href="/workspaces" className="btn btn-pri btn-bl btn-lg" style={{ marginTop: 14 }}>
            เข้าร่วมทีม
          </Link>
        </div></div>
        <p className="auth-foot mn" style={{ fontSize: 11 }}>โทเคน {token.slice(0, 8)}… · อายุ 7 วัน</p>
      </div>
    </div>
  );
}
