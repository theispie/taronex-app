import Link from 'next/link';
import { CURRENT_USER } from '@/mock/data';

/**
 * หน้าจอ 43 · ตั้งค่าบัญชีส่วนตัว
 * ชื่อ รหัสผ่าน ภาษา รูป เป็นของคน · ตำแหน่งงานเป็นของ membership
 * เพราะคนเดียวกันมีตำแหน่งต่างกันในแต่ละที่ทำงานได้
 */
export default function AccountPage() {
  return (
    <div className="auth-wrap" style={{ alignItems: 'start', paddingTop: 48 }}>
      <div className="auth-box" style={{ maxWidth: 520 }}>
        <div className="auth-brand"><span className="mark">T</span><b>TaroNex</b></div>
        <h1 className="auth-h1" style={{ marginBottom: 5 }}>ตั้งค่าบัญชีส่วนตัว</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          ค่าเหล่านี้ใช้กับทุกที่ทำงานที่คุณอยู่
        </p>
        <div className="card"><div className="card-b">
          <div className="fld"><label className="lbl" htmlFor="an">ชื่อ</label>
            <input id="an" className="inp" defaultValue={CURRENT_USER.name} /></div>
          <div className="fld"><label className="lbl" htmlFor="ae">อีเมล</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input id="ae" className="inp mn" defaultValue={CURRENT_USER.email} readOnly
                     style={{ background: 'var(--surface-2)', color: 'var(--muted)' }} />
              <span className="soon-badge">v3</span>
            </div>
            <div className="hint">ยังเปลี่ยนอีเมลเองไม่ได้ เพราะอีเมลคือหลักฐานว่าใครเป็นใครในคำเชิญ</div>
          </div>
          <div className="fld"><label className="lbl" htmlFor="al">ภาษา</label>
            <select id="al" className="inp" defaultValue="th">
              <option value="th">ไทย</option><option value="en">English</option>
            </select>
            <div className="hint">ใช้กับทั้งหน้าเว็บและอีเมลที่ระบบส่งหาคุณ</div>
          </div>
          <button type="button" className="btn btn-pri">บันทึก</button>
        </div></div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h"><b>ที่ทำงานที่คุณอยู่</b></div>
          <div className="row"><span className="row-title">ดิจิทัลเอ็กซ์ จำกัด</span>
            <span className="chip st-review">เจ้าของ</span><span className="chip">PM</span></div>
          <div className="row"><span className="row-title">ทองไทย มีเดีย</span>
            <span className="chip">สมาชิก</span><span className="chip">Dev</span></div>
        </div>

        <div className="alert i" style={{ marginTop: 16 }}>
          <span>ℹ</span>
          <div>ปุ่ม “ออกจากที่นี่” ไม่มีในแถวแรก เพราะทุกที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ
            ต้องแต่งตั้งเจ้าของคนใหม่ก่อน</div>
        </div>
        <p className="auth-foot"><Link href="/workspaces" className="auth-link">กลับไปเลือกที่ทำงาน</Link></p>
      </div>
    </div>
  );
}
