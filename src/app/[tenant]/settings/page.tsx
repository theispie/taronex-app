import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS } from '@/mock/data';

/**
 * หน้าจอ 08 · รายชื่อสมาชิก
 * ไม่มีตารางสิทธิ์แบบ role × action — ตั้งใจตัด เพราะเป็นหลุมที่ลึกที่สุดของระบบแบบนี้
 * ตำแหน่งงานไม่ใช่สิทธิ์ — จุดที่พลาดบ่อยที่สุดของทั้งระบบ
 */
const JOB_LABEL: Record<string, string> = {
  pm: 'PM', ba: 'BA', dev: 'Dev', qa: 'QA', design: 'Design', other: 'อื่นๆ',
};
const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ', member: 'สมาชิก', viewer: 'ผู้ชม', guest: 'แขก',
};
const PM_OF: Record<string, string> = { u1: 'ACME, ทองไทย', u3: 'แคมเปญ Q3' };
const LAST_SEEN: Record<string, string> = {
  u1: 'วันนี้ 09:12', u2: 'วันนี้ 08:40', u3: 'เมื่อวาน', u4: 'วันนี้ 10:05', u5: '3 วันก่อน',
};

export default function SettingsPage() {
  return (
    <>
      <MockNotice />
      <PageHead
        title="สมาชิก"
        desc={`${MEMBERS.length} คน · ทุกคนเห็นทุกโปรเจกต์`}
        right={<button type="button" className="btn btn-pri">＋ เชิญสมาชิก</button>}
      />
      <div className="tabs" style={{ marginBottom: 16 }}>
        <a>ทั่วไป</a>
        <a className="on">สมาชิก</a>
        <a>เวลาทำการ</a>
        <a>แผนและการชำระเงิน</a>
      </div>
      <Card>
        <table className="tbl">
          <thead>
            <tr>
              <th>ชื่อ</th><th>ตำแหน่งงาน</th><th>สิทธิ์</th>
              <th>เป็น PM ของ</th><th>เข้าใช้ล่าสุด</th><th />
            </tr>
          </thead>
          <tbody>
            {MEMBERS.map((m) => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar member={m} size="sm" />
                    <div>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="mn" style={{ fontSize: 11, color: 'var(--faint)' }}>
                        {m.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td><span className="chip">{JOB_LABEL[m.jobTitle]}</span></td>
                <td>
                  <span className={`chip ${m.role === 'owner' ? 'st-review' : ''}`}>
                    {ROLE_LABEL[m.role]}
                  </span>
                </td>
                <td className="sub">{PM_OF[m.id] ?? '—'}</td>
                <td className="mn sub">{LAST_SEEN[m.id] ?? '—'}</td>
                <td style={{ textAlign: 'right', color: 'var(--faint)' }}>⋯</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="alert i" style={{ marginTop: 16 }}>
        <span>ℹ</span>
        <div>
          <b>ตำแหน่งงานไม่ใช่สิทธิ์</b> — Dev, QA, Design, BA ใช้แสดงผลและกรองงานเท่านั้น
          สิทธิ์จริงมีสองระดับคือเจ้าของที่ทำงาน กับ PM ของแต่ละโปรเจกต์
        </div>
      </div>
    </>
  );
}
