import Link from 'next/link';
import { MockNotice, PageHead } from '@/components/ui';
import { TEMPLATES } from '@/mock/data';

/**
 * หน้าจอ 40 · คลังแม่แบบโปรเจกต์
 * แปดแม่แบบพอ ไม่ต้องสี่สิบ — คนส่วนใหญ่ใช้อยู่หนึ่งถึงสองแบบหรือเริ่มจากศูนย์
 * "แม่แบบของทีมเรา" อยู่บนสุด เพราะกระบวนการของเอเจนซี่เองมีค่ากว่าแม่แบบกลาง
 */
/**
 * ตารางแม่แบบ — ประกาศระดับโมดูล ไม่ซ้อนในหน้า
 * คอมโพเนนต์ที่ประกาศซ้อนจะถูกมองว่าเป็นชนิดใหม่ทุกครั้งที่ render
 */
function TemplateGrid({ list, tenant }: { list: typeof TEMPLATES; tenant: string }) {
  return (
    <div className="grid3 mb">
      {list.map((t) => (
        <Link key={t.id} href={`/${tenant}/templates/${t.id}/edit`} className="card pcard">
          <div className="card-b">
            <b style={{ fontSize: 13.5 }}>{t.name}</b>
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
          </div>
        </Link>
      ))}
    </div>
  );
}

export default async function TemplatesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const mine = TEMPLATES.filter((t) => t.owner === 'team');
  const central = TEMPLATES.filter((t) => t.owner === 'central');

  return (
    <>
      <MockNotice />
      <PageHead
        title="แม่แบบโปรเจกต์"
        right={
          <Link href={`/${tenant}/templates/new`} className="btn btn-pri btn-sm">
            ＋ บันทึกโปรเจกต์เป็นแม่แบบ
          </Link>
        }
      />
      <div className="ph">
        <h1 style={{ fontSize: 15 }}>แม่แบบของทีมเรา</h1>
      </div>
      <TemplateGrid list={mine} tenant={tenant} />
      <div className="ph">
        <h1 style={{ fontSize: 15 }}>แม่แบบสำเร็จรูป</h1>
      </div>
      <TemplateGrid list={central} tenant={tenant} />
      <div className="alert i">
        <span>ℹ</span>
        <div>สร้างโปรเจกต์จากแม่แบบแล้ว แก้แม่แบบทีหลังจะไม่กระทบโปรเจกต์เก่า</div>
      </div>
    </>
  );
}
