import { notFound } from 'next/navigation';
import { Avatar, Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { isClosed } from '@/lib/types';
import { MEMBERS, columnsOfProject, projectByKey, tasksOfProject } from '@/mock/data';

/**
 * หน้าจอ 14 · สมาชิกในโปรเจกต์
 * หน้านี้ไม่ใช่หน้าจัดสิทธิ์ ต้องบอกให้ชัดตั้งแต่บรรทัดแรก
 * คอลัมน์ "ถืออยู่" ช่วยตัดสินใจตอนจะโยนงานให้ใคร
 */
const JOB: Record<string, string> = {
  pm: 'PM', ba: 'BA', dev: 'Dev', qa: 'QA', design: 'Design', other: 'อื่นๆ',
};

export default async function ProjectMembers({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  return (
    <>
      <MockNotice />
      <PageHead title="ทีมงาน" desc={`${p.name} · ${p.key}`} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />
      <div className="alert i" style={{ marginBottom: 14 }}>
        <span>ℹ</span>
        <div>หน้านี้ไม่ใช่หน้าจัดสิทธิ์ — เป็นแค่รายชื่อคนที่ทำงานในโปรเจกต์นี้
          สิทธิ์เข้าถึงตั้งที่แท็บ “สิทธิ์”</div>
      </div>
      <Card>
        <table className="tbl">
          <thead><tr><th>ชื่อ</th><th>ตำแหน่งงาน</th><th>บทบาทในโปรเจกต์</th><th>ถืออยู่</th></tr></thead>
          <tbody>
            {MEMBERS.filter((m) => m.role !== 'guest').map((m) => {
              const held = tasksOfProject(key)
                .filter((t) => t.assigneeId === m.id && !isClosed(t, columnsOfProject(key))).length;
              return (
                <tr key={m.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Avatar member={m} size="sm" />
                    <div><div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div className="mn" style={{ fontSize: 11, color: 'var(--faint)' }}>{m.email}</div></div>
                  </div></td>
                  <td><span className="chip">{JOB[m.jobTitle]}</span></td>
                  <td>{m.id === p.pmUserId ? <span className="chip st-review">PM</span>
                       : <span className="sub">ทีมงาน</span>}</td>
                  <td className="mn">{held} ใบ</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="hint" style={{ marginTop: 10 }}>
        PM เก็บได้คนเดียว · เปลี่ยน PM ได้เฉพาะเจ้าของที่ทำงานหรือ PM คนปัจจุบัน
      </div>
    </>
  );
}
