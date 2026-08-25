'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 40 · คลังแม่แบบโปรเจกต์
 *
 * แปดแม่แบบพอ ไม่ต้องสี่สิบ — คนส่วนใหญ่ใช้อยู่หนึ่งถึงสองแบบหรือเริ่มจากศูนย์
 * ถ้ามีสี่สิบชุด คนจะเสียเวลาเลือกมากกว่าเวลาที่ประหยัดได้
 *
 * "แม่แบบของทีมเรา" อยู่บนสุดเหนือแม่แบบสำเร็จรูป
 * เพราะกระบวนการของเอเจนซี่เองมีค่ากว่าแม่แบบกลาง
 *
 * การ์ดแม่แบบบอกล่วงหน้าว่าจะได้คอลัมน์ชื่ออะไรและประเภทงานอะไร
 * ไม่ต้องกดเข้าไปดูถึงจะรู้
 */
interface Template {
  id: string;
  name: string;
  description: string;
  isCentral: boolean;
  useCount: number;
  columns: string[];
  types: string[];
  features: string[];
  taskCount: number;
  phaseCount: number;
}

function TemplateCard({ t, tenant }: { t: Template; tenant: string }) {
  return (
    <div className="card pcard">
      <div className="card-b">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 13.5 }}>{t.name}</b>
          {t.isCentral ? null : <span className="chip st-review">ของทีม</span>}
        </div>
        <div className="sub" style={{ marginTop: 6, fontSize: 12 }}>
          {t.features.length > 0
            ? `แบ่งงานเป็น ${t.features.join(' · ')}`
            : 'เริ่มจากบอร์ดเปล่า ไม่มีงานหลักตั้งต้น'}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {t.types.map((x) => (
            <span key={x} className="tag">
              {x}
            </span>
          ))}
        </div>
        <div className="sub mn" style={{ marginTop: 8, fontSize: 11.5 }}>
          {t.taskCount} การ์ดตั้งต้น · คอลัมน์ {t.columns.join(' / ')}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <Link href={`/${tenant}/projects/new?template=${t.id}`} className="btn btn-sm btn-pri">
            ใช้แม่แบบนี้
          </Link>
          {t.isCentral ? null : (
            <Link href={`/${tenant}/templates/${t.id}/edit`} className="btn btn-sm btn-2">
              แก้ไข
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const tenant = String(useParams().tenant ?? '');
  const [rows, setRows] = useState<Template[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Template[]>(`/t/${tenant}/templates`));
    } catch (e) {
      setErr(errorText(e));
      setRows([]);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = (rows ?? []).filter((t) => !t.isCentral);
  const central = (rows ?? []).filter((t) => t.isCentral);

  return (
    <>
      <PageHead
        title="แม่แบบโปรเจกต์"
        desc={rows ? `${rows.length} ชุด` : 'กำลังโหลด…'}
        right={
          <Link href={`/${tenant}/templates/new`} className="btn btn-pri btn-sm">
            ＋ บันทึกโปรเจกต์เป็นแม่แบบ
          </Link>
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {/* ของทีมมาก่อนเสมอ — กระบวนการของเอเจนซี่เองมีค่ากว่าแม่แบบกลาง */}
      <div className="lbl" style={{ marginBottom: 8 }}>
        แม่แบบของทีมเรา
      </div>
      {mine.length === 0 ? (
        <div className="empty" style={{ marginBottom: 18 }}>
          ยังไม่มีแม่แบบของทีม — บันทึกโปรเจกต์ที่ทำอยู่เป็นแม่แบบได้
        </div>
      ) : (
        <div className="grid3 mb">
          {mine.map((t) => (
            <TemplateCard key={t.id} t={t} tenant={tenant} />
          ))}
        </div>
      )}

      <div className="lbl" style={{ marginBottom: 8 }}>
        แม่แบบสำเร็จรูป
      </div>
      <div className="grid3">
        {central.map((t) => (
          <TemplateCard key={t.id} t={t} tenant={tenant} />
        ))}
      </div>

      <div className="alert i" style={{ marginTop: 16 }}>
        <span>ℹ</span>
        <div>
          แม่แบบสำเร็จรูปแก้ไม่ได้ — สร้างโปรเจกต์จากมันแล้วปรับในโปรเจกต์ หรือบันทึกโปรเจกต์นั้นกลับมาเป็นแม่แบบของทีม ·
          <b> แก้แม่แบบไม่กระทบโปรเจกต์ที่สร้างไปแล้ว</b>
        </div>
      </div>
    </>
  );
}
