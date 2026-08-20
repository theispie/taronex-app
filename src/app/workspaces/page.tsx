import Link from 'next/link';
import { CURRENT_USER, TENANTS } from '@/mock/data';

/**
 * หน้าจอ 42 · หน้ากลาง — ที่ทำงานของฉัน
 * เป็นหนึ่งในสี่จุดที่ข้าม tenant ได้ (GET /me/workspaces)
 * คืนแค่ชื่อกับตัวเลขนับ ห้ามคืนข้อมูลข้างในที่ทำงาน
 */
const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของที่ทำงาน',
  member: 'สมาชิก',
  viewer: 'ผู้ชม — ดูได้อย่างเดียว',
  guest: 'แขก — เห็นเฉพาะโปรเจกต์ที่ถูกเชิญ',
};
const SQ_COLORS = ['#5B5BD6', '#0EA5A4', '#DC2626', '#D97706'];

export default function WorkspacesPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-box" style={{ maxWidth: 460 }}>
        <div className="auth-brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>
        <h1 className="auth-h1" style={{ marginBottom: 4 }}>
          เลือกที่ทำงาน
        </h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          เข้าใช้งานเป็น {CURRENT_USER.name} · <span className="mn">{CURRENT_USER.email}</span>
        </p>

        <div className="card">
          {TENANTS.map((ws, i) => (
            <Link key={ws.code} href={`/${ws.code}`} className="ws-row">
              <span className="sq" style={{ background: SQ_COLORS[i % SQ_COLORS.length] }}>
                {ws.name.slice(0, 2)}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 500 }}>{ws.name}</span>
                <span className="sub" style={{ display: 'block', fontSize: 12 }}>
                  {ROLE_LABEL[ws.role]}
                  {ws.status === 'trial' ? ' · ทดลองใช้' : ''}
                </span>
              </span>
              {ws.waitingOnYou > 0 ? (
                <span
                  className="chip"
                  style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
                >
                  รอคุณ {ws.waitingOnYou}
                </span>
              ) : null}
              <span style={{ color: 'var(--faint)' }}>›</span>
            </Link>
          ))}
        </div>

        <p className="auth-foot">ไม่มีรายชื่อบริษัทให้ค้นหา — เข้าที่ทำงานได้ด้วยคำเชิญเท่านั้น</p>
      </div>
    </div>
  );
}
