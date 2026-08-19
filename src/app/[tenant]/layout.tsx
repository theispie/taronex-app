import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidTenantCode } from '@/lib/tenant-code';
import { CURRENT_USER, tenantByCode } from '@/mock/data';
import { Avatar } from '@/components/ui';

const NAV = [
  { href: '', label: 'หน้าแรก' },
  { href: '/my', label: 'งานที่ได้รับ' },
  { href: '/calendar', label: 'ปฏิทินกำหนดส่ง' },
  { href: '/team', label: 'ภาพรวมทีม' },
  { href: '/activity', label: 'กิจกรรม' },
  { href: '/projects', label: 'โปรเจกต์' },
  { href: '/clients', label: 'ลูกค้า' },
  { href: '/sla', label: 'งานประกัน / SLA' },
  { href: '/templates', label: 'แม่แบบ' },
  { href: '/settings', label: 'ตั้งค่าที่ทำงาน' },
];

export default async function TenantLayout({
  children, params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: code } = await params;

  // เข้าไม่ได้ต้องเป็น 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่าที่ทำงานนี้มีอยู่จริง
  if (!isValidTenantCode(code)) notFound();
  const ws = tenantByCode(code);
  if (!ws) notFound();

  const base = `/${code}`;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-3">
          <div className="truncate text-sm font-semibold text-ink">{ws.name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{code}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`${base}${item.href}`}
              className="rounded-md px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line p-2">
          <Link
            href="/"
            className="block rounded-md px-3 py-1.5 text-sm text-muted hover:bg-line-2"
          >
            สลับที่ทำงาน
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
          <Link href={base} className="font-semibold text-brand md:hidden">
            TaroNex
          </Link>
          <div className="flex-1">
            <input
              type="search"
              placeholder="ค้นหาการ์ด รหัส หรือชื่อโปรเจกต์…"
              className="w-full max-w-md rounded-md border border-line bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <Link href={`${base}/notifications`} className="text-sm text-muted hover:text-ink">
            แจ้งเตือน
          </Link>
          <Avatar member={{ ...CURRENT_USER, role: ws.role, jobTitle: 'pm', active: true }} />
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
