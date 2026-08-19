import { notFound } from 'next/navigation';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { ProjectTabs } from '@/components/project-tabs';
import { FILES, projectByKey } from '@/mock/data';

/**
 * หน้าจอ 37 · ไฟล์ของโปรเจกต์
 * รวมไฟล์ทั้งโปรเจกต์ไว้ที่เดียว เพราะคนจำได้ว่า "มีไฟล์นี้" แต่จำไม่ได้ว่าแนบกับการ์ดใบไหน
 * ป้าย v3 บนปุ่ม Google Drive บอกตรงๆ ว่ายังไม่มี ดีกว่าซ่อนปุ่มไว้แล้วไม่มีใครรู้ว่ากำลังจะมา
 */
export default async function FilesPage({
  params,
}: { params: Promise<{ tenant: string; key: string }> }) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  return (
    <>
      <MockNotice />
      <PageHead
        title="ไฟล์ของโปรเจกต์"
        desc={`${FILES.length} ไฟล์`}
        right={
          <>
            <button type="button" className="btn btn-2 btn-sm" disabled>
              เชื่อม Google Drive <span className="soon-badge">v3</span>
            </button>
            <button type="button" className="btn btn-pri btn-sm">＋ อัปโหลด</button>
          </>
        }
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />
      <Card>
        <table className="tbl">
          <thead><tr><th>ชื่อไฟล์</th><th>ขนาด</th><th>แนบกับ</th><th>โดย</th><th>เมื่อ</th></tr></thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.name}</td>
                <td className="mn sub">{f.size}</td>
                <td><span className="cd mn">{f.attachedTo}</span></td>
                <td className="sub">{f.by}</td>
                <td className="sub">{f.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="hint" style={{ marginTop: 10 }}>
        ไฟล์เก็บที่ DigitalOcean Spaces · เปิดตรงจาก URL สาธารณะไม่ได้ ต้องผ่านลิงก์ที่ระบบเซ็นให้เท่านั้น
      </div>
    </>
  );
}
