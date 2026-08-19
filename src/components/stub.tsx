import { Card, MockNotice } from '@/components/ui';

/** หน้าจอที่ยังไม่ได้ลงรายละเอียด — บอกตรงๆ ว่าอยู่ในคิวไหน ดีกว่าปล่อยให้ 404 */
export function Stub({ screen, title, note }: { screen: string; title: string; note: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <MockNotice />
      <h1 className="mb-1 text-xl font-semibold text-ink">{title}</h1>
      <p className="mb-6 text-sm text-muted">หน้าจอ {screen} ตามสารบัญในสเปค</p>
      <Card className="p-6">
        <p className="text-sm text-ink-2">{note}</p>
        <p className="mt-3 text-xs text-muted">
          โครงหน้าจอนี้ยังไม่ได้ลงรายละเอียด — ดูต้นแบบได้ที่ <code>/app/screens/{screen}.html</code>
        </p>
      </Card>
    </div>
  );
}
