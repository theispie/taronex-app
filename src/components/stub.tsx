import { Card, MockNotice, PageHead } from '@/components/ui';

/** หน้าจอที่ยังไม่ได้ลงรายละเอียด — บอกตรงๆ ว่าอยู่ในคิวไหน ดีกว่าปล่อยให้ 404 */
export function Stub({ screen, title, note }: { screen: string; title: string; note: string }) {
  return (
    <>
      <MockNotice />
      <PageHead title={title} desc={`หน้าจอ ${screen} ตามสารบัญในสเปค`} />
      <Card>
        <div className="card-b">
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{note}</p>
          <p className="hint" style={{ marginTop: 10 }}>
            ดูต้นแบบหน้านี้ได้ที่{' '}
            <a className="auth-link" href={`/prototype/screens/${screen}.html`}>
              /prototype/screens/{screen}.html
            </a>
          </p>
        </div>
      </Card>
    </>
  );
}
