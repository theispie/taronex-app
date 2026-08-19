import Link from 'next/link';
import { CURRENT_USER, TENANTS } from '@/mock/data';

/**
 * หน้าจอ 42 · หน้ากลาง — ที่ทำงานของฉัน
 * เป็นหนึ่งในสี่จุดที่ข้าม tenant ได้ (GET /me/workspaces)
 * คืนแค่ชื่อกับตัวเลขนับ ห้ามคืนข้อมูลในที่ทำงาน
 */
export default function WorkspacesPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
      <div className="mb-8">
        <div className="text-2xl font-bold tracking-tight text-brand">TaroNex</div>
        <h1 className="mt-6 text-lg font-semibold text-ink">เลือกที่ทำงาน</h1>
        <p className="mt-1 text-sm text-muted">
          เข้าสู่ระบบเป็น {CURRENT_USER.name} · {CURRENT_USER.email}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {TENANTS.map((ws) => (
          <Link
            key={ws.code}
            href={`/${ws.code}`}
            className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-1 transition-colors hover:border-brand hover:bg-brand-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-100 text-sm font-bold text-brand-700">
              {ws.name.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">{ws.name}</span>
              <span className="block text-xs text-muted">
                {ROLE_LABEL[ws.role]}
                {ws.status === 'trial' ? ' · ทดลองใช้' : ''}
              </span>
            </span>
            {ws.waitingOnYou > 0 ? (
              <span className="shrink-0 rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn">
                รอคุณ {ws.waitingOnYou}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      <p className="mt-8 border-t border-line pt-4 text-xs text-muted">
        ไม่มีรายชื่อบริษัทให้ค้นหา — เข้าที่ทำงานได้ด้วยคำเชิญเท่านั้น
      </p>
    </main>
  );
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของ',
  member: 'สมาชิก',
  viewer: 'ผู้ชม — ดูได้อย่างเดียว',
  guest: 'แขก — เห็นเฉพาะโปรเจกต์ที่ถูกเชิญ',
};
