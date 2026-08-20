import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SideNav } from '@/components/side-nav';
import { isValidTenantCode } from '@/lib/tenant-code';
import { CURRENT_USER, tenantByCode } from '@/mock/data';

export default async function TenantLayout({
  children,
  params,
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
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>

        <Link href="/workspaces" className="wsp">
          <span className="sq">{ws.name.slice(0, 2)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ws.name}
          </span>
          <span className="cx">▾</span>
        </Link>

        <SideNav base={base} />

        <div className="me">
          <span className="av" style={{ background: '#5B5BD6' }}>
            {CURRENT_USER.initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: '12.5px' }}>{CURRENT_USER.name}</div>
            <div style={{ fontSize: '10.5px', color: '#6E7391' }}>
              PM · {ws.role === 'owner' ? 'เจ้าของที่ทำงาน' : 'สมาชิก'}
            </div>
          </div>
          <Link href="/" style={{ marginLeft: 'auto', color: '#6E7391' }} title="ออกจากระบบ">
            ▾
          </Link>
        </div>
      </aside>

      <div className="main">
        <div className="top">
          <div className="crumb">
            <b>{ws.name}</b>
          </div>
          <div style={{ flex: 1 }} />
          <div className="srch">
            🔍 ค้นหาทิกเก็ต โปรเจกต์…
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>⌘K</span>
          </div>
          <Link href={`${base}/notifications`} className="ico">
            ◉<i className="dn" />
          </Link>
          <div className="ico">?</div>
          <span className="av av-sm" style={{ background: '#5B5BD6' }}>
            {CURRENT_USER.initials}
          </span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
