'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** โครงเมนูยกมาจากต้นแบบ docs/screens/08.html ตรงๆ */
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'งานของฉัน',
    items: [
      { href: '', icon: '⌂', label: 'หน้าแรก' },
      { href: '/my', icon: '☑', label: 'งานที่ได้รับ', badge: 4 },
      { href: '/calendar', icon: '▤', label: 'ปฏิทินกำหนดส่ง' },
      { href: '/notifications', icon: '◉', label: 'การแจ้งเตือน', badge: 3 },
    ],
  },
  {
    label: 'ทีม',
    items: [
      { href: '/projects', icon: '▦', label: 'โปรเจกต์' },
      { href: '/team', icon: '⚇', label: 'ภาพรวมทีม' },
      { href: '/activity', icon: '◷', label: 'กิจกรรม' },
    ],
  },
  {
    label: 'ลูกค้า',
    items: [
      { href: '/clients', icon: '◍', label: 'ลูกค้า' },
      { href: '/sla', icon: '⏱', label: 'งานประกัน / SLA' },
    ],
  },
  {
    label: 'ภายหลัง',
    items: [
      { href: '', icon: '◔', label: 'ลงเวลา', soon: 'v3' },
      { href: '', icon: '▥', label: 'รายงาน', soon: 'v3' },
    ],
  },
  {
    label: 'ตั้งค่า',
    items: [
      { href: '/templates', icon: '▤', label: 'แม่แบบ' },
      { href: '/settings', icon: '⚙', label: 'ตั้งค่าที่ทำงาน' },
    ],
  },
];

interface NavItem {
  href: string;
  icon: string;
  label: string;
  badge?: number;
  soon?: string;
}

export function SideNav({ base }: { base: string }) {
  const path = usePathname();

  return (
    <nav>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="lb">{g.label}</div>
          {g.items.map((it) => {
            const href = `${base}${it.href}`;
            const active = it.soon ? false : path === href;
            if (it.soon) {
              return (
                <a key={it.label} aria-disabled className="soon-row">
                  <span className="ic">{it.icon}</span>
                  {it.label}
                  <span className="soon">{it.soon}</span>
                </a>
              );
            }
            return (
              <Link key={it.label} href={href} className={active ? 'on' : ''}>
                <span className="ic">{it.icon}</span>
                {it.label}
                {it.badge ? <span className="bg">{it.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
