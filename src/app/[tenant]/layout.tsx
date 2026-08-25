import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SideNav } from '@/components/side-nav';
import { requireTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';

/**
 * เปลือกของทุกหน้าในที่ทำงานหนึ่ง — และเป็นด่านตรวจสิทธิ์ของฝั่งหน้าเว็บ
 *
 * ตรวจฝั่งเซิร์ฟเวอร์เสมอ ไม่เชื่อรหัสใน URL
 * รหัสที่ทำงานโผล่ในประวัติเบราว์เซอร์และลิงก์ที่คนส่งต่อกัน มันไม่ใช่สิทธิ์
 *
 * ไม่ได้เป็นสมาชิก = 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่าที่ทำงานนี้มีอยู่จริง
 * ยังไม่ล็อกอิน = ส่งไปหน้าเข้าสู่ระบบ ไม่ใช่ 404 เพราะยังไม่รู้ว่าเขามีสิทธิ์หรือเปล่า
 */
const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของที่ทำงาน',
  member: 'สมาชิก',
  viewer: 'ผู้ชม',
  guest: 'แขก',
};

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: code } = await params;

  let ctx: Awaited<ReturnType<typeof requireTenant>>;
  try {
    ctx = await requireTenant(code);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'E_UNAUTHENTICATED') redirect('/login');
    notFound();
  }

  const base = `/${code}`;
  const initials = ctx.name.trim().slice(0, 2);

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span className="mark">T</span>
          <b>TaroNex</b>
        </div>

        <Link href="/workspaces" className="wsp">
          <span className="sq">{ctx.tenantName.slice(0, 2)}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ctx.tenantName}
          </span>
          <span className="cx">▾</span>
        </Link>

        <SideNav base={base} />

        <div className="me">
          <span className="av" style={{ background: '#5B5BD6' }}>
            {initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: '12.5px' }}>{ctx.name}</div>
            <div style={{ fontSize: '10.5px', color: '#6E7391' }}>
              {ROLE_LABEL[ctx.role] ?? ctx.role}
            </div>
          </div>
          <Link href="/account" style={{ marginLeft: 'auto', color: '#6E7391' }} title="ตั้งค่าบัญชี">
            ▾
          </Link>
        </div>
      </aside>

      <div className="main">
        <div className="top">
          <div className="crumb">
            <b>{ctx.tenantName}</b>
          </div>
          <div style={{ flex: 1 }} />
          <div className="srch">
            🔍 ค้นหาทิกเก็ต โปรเจกต์…
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>⌘K</span>
          </div>
          {/*
            เดิมมีจุดแดง <i className="dn" /> ติดอยู่ตลอดเวลา ซึ่งเป็นของจากต้นแบบ
            ไม่ได้ผูกกับข้อมูลจริงเลย — บอกว่ามีของใหม่ทั้งที่ไม่มี
            เอาออกจนกว่าจะมีอะไรเขียนลงตาราง notifications จริงๆ
          */}
          <Link href={`${base}/notifications`} className="ico" title="การแจ้งเตือน">
            ◉
          </Link>
          <div className="ico">?</div>
          <span className="av av-sm" style={{ background: '#5B5BD6' }}>
            {initials}
          </span>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
