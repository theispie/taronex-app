import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProjectTabs } from '@/components/project-tabs';
import { Avatar, Card, HeldTag, MockNotice, PageHead } from '@/components/ui';
import { columnIndexOf, columnNameOf, taskCode, toneOf } from '@/lib/types';
import { columnsOfProject, memberById, projectByKey, tasksOfProject } from '@/mock/data';

/**
 * หน้าจอ 18 · มุมมองตาราง
 * ตารางเรียงตามงานหลักเสมอ ไม่ให้เรียงตามอย่างอื่น เพราะโครงสร้างงานคือสิ่งที่คนต้องจำ
 * มิเตอร์ขีดซ้ำจากบอร์ด (จำนวนขีด = จำนวนคอลัมน์) อ่านความคืบหน้าได้โดยไม่ต้องอ่านคำ
 * ตัวกรองทุกตัวสะท้อนใน URL เพื่อคัดลอกลิงก์ส่งกันได้
 */
export default async function ListPage({
  params,
}: {
  params: Promise<{ tenant: string; key: string }>;
}) {
  const { tenant, key } = await params;
  const p = projectByKey(key);
  if (!p) notFound();
  const tasks = tasksOfProject(key);
  const cols = columnsOfProject(key);
  const groups = [
    ...p.features.map((f) => ({ name: f.name, items: tasks.filter((t) => t.featureId === f.id) })),
    { name: 'งานนอกแผน', items: tasks.filter((t) => !t.featureId) },
  ];

  return (
    <>
      <MockNotice />
      <PageHead title={p.name} desc={`${p.key} · มุมมองตาราง`} />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={p.phase.kind === 'warranty'} />

      <div className="filters mb">
        <input className="inp" placeholder="ค้นหาในโปรเจกต์นี้…" style={{ maxWidth: 240 }} />
        <select className="inp" style={{ maxWidth: 150 }}>
          <option>ทุกคอลัมน์</option>
          {p.columnLabels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="inp" style={{ maxWidth: 150 }}>
          <option>ทุกคน</option>
        </select>
        <span className="hint">ตัวกรองสะท้อนใน URL — คัดลอกลิงก์ส่งให้เพื่อนได้เลย</span>
      </div>

      {groups.map((g) => (
        <Card key={g.name} className="mb">
          <div className="card-h">
            <b>{g.name}</b>
            <div className="r">
              <span className="sub mn">{g.items.length} การ์ด</span>
            </div>
          </div>
          {g.items.length === 0 ? (
            <div className="empty">ยังไม่มีการ์ดในก้อนนี้</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 78 }}>รหัส</th>
                  <th>ชื่อ</th>
                  <th style={{ width: 130 }}>คอลัมน์</th>
                  <th style={{ width: 110 }}>ผู้รับผิดชอบ</th>
                  <th style={{ width: 100 }}>กำหนดส่ง</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link href={`/${tenant}/tickets/${taskCode(t)}`} className="cd mn">
                        {taskCode(t)}
                      </Link>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{t.title}</span>{' '}
                      <HeldTag days={t.heldDays} />
                    </td>
                    <td>
                      <span className={`chip st-${toneOf(t, cols)}`}>{columnNameOf(t, cols)}</span>
                      <div className="barn" aria-hidden>
                        {cols.map((c, i) => (
                          <i key={c.key} className={i <= columnIndexOf(t, cols) ? 'on' : ''} />
                        ))}
                      </div>
                    </td>
                    <td>
                      {t.assigneeId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Avatar member={memberById(t.assigneeId)} size="sm" />
                          <span className="sub">{memberById(t.assigneeId)?.name}</span>
                        </div>
                      ) : (
                        <span className="sub">—</span>
                      )}
                    </td>
                    <td className="mn sub">{t.dueDate ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ))}
    </>
  );
}
