'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 13 · ภาพรวมโปรเจกต์  ·  13ข เมื่ออยู่ในเฟสประกัน
 *
 * ตัวเลขทั้งหมดคำนวณสดจากฐานข้อมูล ไม่มีค่าไหนเก็บไว้เป็นคอลัมน์
 * ขอบเขตบานปลายวัดจาก "จำนวนการ์ดที่เพิ่มหลังบันทึกตัวเลขตั้งต้น" ไม่ใช่ชั่วโมง
 * เพราะงานเหมาคิดเป็นก้อน ไม่ได้คิดเป็นชั่วโมง
 */
interface Feature {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  startsOn: string | null;
  endsOn: string | null;
}
interface Project {
  id: string;
  key: string;
  name: string;
  clientName: string;
  board: { key: string; name: string }[];
  taskCount: number;
  baselineTaskCount: number | null;
  portalEnabled: boolean;
  isArchived: boolean;
  currentPhaseId: string | null;
  phases: { id: string; name: string; kind: string }[];
  features: Feature[];
  yourAccess: string;
  youArePm: boolean;
}
interface Health {
  addedAfterBaseline: number | null;
  unplannedTasks: number;
  warrantyTasks: number;
  bounceCount: number;
}

export default function ProjectOverviewPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const [proj, setProj] = useState<Project | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Project>(`/t/${tenant}/projects/${key}`),
      api.get<Health>(`/t/${tenant}/projects/${key}/health`),
    ])
      .then(([a, b]) => {
        setProj(a);
        setHealth(b);
      })
      .catch((e) => setErr(errorText(e)));
  }, [tenant, key]);

  const phase = proj?.phases.find((ph) => ph.id === proj.currentPhaseId) ?? null;
  const warranty = phase?.kind === 'warranty';
  const added = health?.addedAfterBaseline;

  return (
    <>
      <PageHead
        title={proj ? `${proj.key} · ${proj.name}` : key}
        desc={proj ? proj.clientName : 'กำลังโหลด…'}
        right={
          proj?.yourAccess === 'write' ? (
            <Link href={`/${tenant}/projects/${key}/edit`} className="btn btn-2 btn-sm">
              แก้ไขโปรเจกต์
            </Link>
          ) : undefined
        }
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} warranty={warranty} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {proj ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span className={`chip ${warranty ? 'st-done' : 'st-doing'}`}>
              เฟส: {phase?.name ?? 'ยังไม่ได้ตั้ง'}
            </span>
            {proj.portalEnabled ? <span className="chip st-done">พอร์ทัลเปิดอยู่</span> : null}
            {proj.youArePm ? <span className="chip st-review">คุณเป็น PM</span> : null}
            {proj.yourAccess === 'read' ? <span className="chip">คุณดูได้อย่างเดียว</span> : null}
            {proj.isArchived ? <span className="chip">ปิดแล้ว</span> : null}
          </div>

          <div className="statgrid mb">
            <Card>
              <div className="card-b stat">
                <b>{proj.taskCount}</b>
                <span>การ์ดทั้งหมด</span>
              </div>
            </Card>
            <Card>
              <div className="card-b stat">
                <b>{proj.baselineTaskCount ?? '—'}</b>
                <span>ตั้งต้นตอนเริ่ม</span>
              </div>
            </Card>
            <Card>
              <div className="card-b stat">
                <b className={added !== null && added !== undefined && added > 2 ? 'txt-warn' : ''}>
                  {added === null || added === undefined ? '—' : `+${added}`}
                </b>
                <span>การ์ดที่เพิ่ม</span>
              </div>
            </Card>
            <Card>
              <div className="card-b stat">
                <b>{health?.unplannedTasks ?? 0}</b>
                <span>งานนอกแผน</span>
              </div>
            </Card>
            <Card>
              <div className="card-b stat">
                <b>{health?.bounceCount ?? 0}</b>
                <span>รอบตีกลับ</span>
              </div>
            </Card>
          </div>

          {proj.baselineTaskCount === null ? (
            <div className="alert i" style={{ marginBottom: 14 }}>
              <span>ℹ</span>
              <div>
                ยังไม่ได้บันทึกจำนวนการ์ดตั้งต้น — บันทึกไว้ตอนเริ่มงาน แล้วจะเทียบได้ว่าขอบเขตบานปลายไปเท่าไรตอนส่งมอบ
              </div>
            </div>
          ) : null}

          <Card className="mb">
            <div className="card-h">
              <b>งานหลัก</b>
              <div className="r">
                <Link href={`/${tenant}/projects/${key}/features`} className="btn btn-sm btn-gh">
                  ตั้งค่างานหลัก
                </Link>
              </div>
            </div>
            <div className="card-b">
              {proj.features.length === 0 ? (
                <div className="empty">ยังไม่มีงานหลัก · การ์ดทุกใบนับเป็นงานนอกแผน</div>
              ) : (
                proj.features.map((f) => (
                  <div className="row" key={f.id}>
                    <span className="row-title">{f.name}</span>
                    <span className="sub mn">{f.taskCount} การ์ด</span>
                    <span className="sub">
                      {f.startsOn && f.endsOn ? `${f.startsOn} → ${f.endsOn}` : 'ยังไม่มีวันจากการ์ด'}
                    </span>
                  </div>
                ))
              )}
              <div className="hint" style={{ marginTop: 8 }}>
                ช่วงงานคำนวณจากการ์ดลูกเสมอ ไม่มีวันที่ให้กรอกเอง
              </div>
            </div>
          </Card>

          {warranty ? (
            <div className="alert o">
              <span>✓</span>
              <div>
                โปรเจกต์นี้อยู่ในเฟสประกัน — พอร์ทัลลูกค้าเปิดแล้ว และงานที่ลูกค้าแจ้งจะเข้าคิวคัดแยก (
                {health?.warrantyTasks ?? 0} เรื่อง)
              </div>
            </div>
          ) : null}
        </>
      ) : !err ? (
        <div className="hint">กำลังโหลด…</div>
      ) : null}
    </>
  );
}
