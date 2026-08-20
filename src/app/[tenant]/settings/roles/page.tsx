import { SettingsTabs } from '@/components/settings-tabs';
import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { MEMBERS } from '@/mock/data';

/**
 * หน้าจอ 08ข · สมาชิก — บทบาทและการโอนสิทธิ์
 * เจ้าของมีได้หลายคน — ถ้าเจ้าของคนเดียวลาออกหรือลืมรหัส ทั้งบริษัทติดล็อกทันที
 * ผู้ชมกับแขกเป็นคนละปัญหา: ผู้ชม = "เห็นแต่แตะไม่ได้" · แขก = "ไม่เห็นเลย"
 */
const ROLES = [
  { key: 'owner', name: 'เจ้าของ', sees: 'เห็นทุกอย่าง และจัดการที่ทำงาน สมาชิก แผน และการชำระเงินได้' },
  { key: 'member', name: 'สมาชิก', sees: 'เห็นทุกโปรเจกต์ และร่วมงานได้ตามที่แต่ละโปรเจกต์ตั้งไว้' },
  { key: 'viewer', name: 'ผู้ชม', sees: 'เห็นทุกโปรเจกต์ แต่กดแก้อะไรไม่ได้เลย' },
  { key: 'guest', name: 'แขก', sees: 'เห็นเฉพาะโปรเจกต์ที่ถูกเชิญเข้ามาโดยตรง ไม่มีหน้าจอข้ามโปรเจกต์' },
];

export default async function RolesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const owners = MEMBERS.filter((m) => m.role === 'owner');
  return (
    <>
      <MockNotice />
      <PageHead title="บทบาทและสิทธิ์" desc="ใครเห็นอะไร และโอนความเป็นเจ้าของ" />
      <SettingsTabs base={`/${tenant}`} />

      <Card className="mb">
        <div className="card-h">
          <b>แต่ละบทบาทเห็นอะไร</b>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 130 }}>บทบาท</th>
              <th>เห็นอะไร</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.key}>
                <td>
                  <span className={`chip ${r.key === 'owner' ? 'st-review' : ''}`}>{r.name}</span>
                </td>
                <td className="sub">{r.sees}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="card-h">
          <b>เจ้าของที่ทำงาน</b>
          <div className="r">
            <button type="button" className="btn btn-2 btn-sm">
              ＋ แต่งตั้งเจ้าของเพิ่ม
            </button>
          </div>
        </div>
        {owners.map((m) => (
          <div key={m.id} className="row">
            <Avatar member={m} size="sm" />
            <span className="row-title">{m.name}</span>
            <span className="mn sub">{m.email}</span>
            <button
              type="button"
              className="btn btn-sm btn-dn"
              disabled={owners.length <= 1}
              title={owners.length <= 1 ? 'ถอดไม่ได้ ต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ' : ''}
            >
              ถอดสิทธิ์เจ้าของ
            </button>
          </div>
        ))}
        <div className="card-b">
          <div className="alert w">
            <span>⚠</span>
            <div>
              ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ — บังคับที่ระดับฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่ม
              <br />
              เจ้าของคนเดียวลาออกหรือลืมรหัส = ทั้งบริษัทติดล็อก แนะนำให้มีอย่างน้อยสองคน
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
