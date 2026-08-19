import { notFound } from 'next/navigation';
import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { MEMBERS, projectByKey } from '@/mock/data';
import { resolveAccess } from '@/lib/access';

/**
 * หน้าจอ 45 · สิทธิ์การเข้าถึงโปรเจกต์
 * ค่าเริ่มต้นระดับโปรเจกต์ + รายชื่อยกเว้น พูดเป็นประโยคเดียวได้ และไม่เกิดงานธุรการทุกครั้งที่มีคนใหม่
 * "ดูอย่างเดียว" เป็นประตูฝั่งเขียน ไม่ใช่ฝั่งอ่าน — ไม่ต้องแตะ SELECT สักตัว
 * รายชื่อยกเว้นใช้ตารางเดียวกับที่ให้สิทธิ์แขก จึงได้สองฟีเจอร์จากตารางเดียว
 */
const OVERRIDES: Record<string, 'read' | 'write'> = { u4: 'read' };

export default async function AccessPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();

  return (
    <>
      <MockNotice />
      <PageHead title="สิทธิ์การเข้าถึง" desc={`${p.name} · ${p.key}`} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />

      <Card className="mb">
        <div className="card-h"><b>ค่าเริ่มต้นของโปรเจกต์นี้</b></div>
        <div className="card-b">
          <label className="radrow">
            <input type="radio" name="acc" defaultChecked={p.memberAccess === 'collaborate'} />
            <span><b>ร่วมงานได้</b><br />
              <span className="sub">สมาชิกทุกคนสร้างและแก้การ์ดในโปรเจกต์นี้ได้</span></span>
          </label>
          <label className="radrow">
            <input type="radio" name="acc" defaultChecked={p.memberAccess === 'read_only'} />
            <span><b>ดูอย่างเดียว</b><br />
              <span className="sub">สมาชิกเห็นทุกอย่าง แต่แก้ไม่ได้ ยกเว้นคนในรายชื่อข้างล่าง</span></span>
          </label>
        </div>
      </Card>

      <Card className="mb">
        <div className="card-h"><b>รายชื่อยกเว้น</b>
          <div className="r"><button type="button" className="btn btn-2 btn-sm">＋ เพิ่มคน</button></div></div>
        <table className="tbl">
          <thead><tr><th>คน</th><th>บทบาทในที่ทำงาน</th><th>ผลลัพธ์จริง</th></tr></thead>
          <tbody>
            {MEMBERS.map((m) => {
              const a = resolveAccess({
                role: m.role,
                projectAccess: p.memberAccess,
                override: OVERRIDES[m.id],
                isPm: m.id === p.pmUserId,
              });
              const label = a === 'write' ? 'ร่วมงานได้' : a === 'read' ? 'ดูอย่างเดียว' : 'ไม่เห็นโปรเจกต์นี้';
              const cls = a === 'write' ? 'st-done' : a === 'read' ? 'st-todo' : '';
              return (
                <tr key={m.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar member={m} size="sm" /><span style={{ fontWeight: 500 }}>{m.name}</span>
                    {OVERRIDES[m.id] ? <span className="chip">ยกเว้นรายคน</span> : null}
                  </div></td>
                  <td className="sub">{m.role}</td>
                  <td><span className={`chip ${cls}`}>{label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="alert i">
        <span>ℹ</span>
        <div>ผลลัพธ์ในตารางนี้มาจากฟังก์ชันเดียวคือ <code>resolveAccess()</code> —
          ทุก route และทุกปุ่มในระบบใช้ตัวเดียวกันนี้ ไม่มีที่ไหนตรวจสิทธิ์เอง</div>
      </div>
    </>
  );
}
