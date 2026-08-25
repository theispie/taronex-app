'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * โครงเมนูยกมาจากต้นแบบ docs/screens/08.html
 *
 * ═══ 🔴 ไม่มีตัวเลขท้ายเมนู และอย่าเอากลับมาแบบเดิม ═══
 * ต้นแบบมีป้ายตัวเลข (งานที่ได้รับ 4 · แจ้งเตือน 3 · คิวคัดแยก 2) ซึ่งเป็น**เลขสมมติ**
 * ตอนยกโครงมาเขียนติดมาด้วยแล้วค้างอยู่ — เมนูบอกว่ามีแจ้งเตือน 3 รายการ
 * แต่กดเข้าไปแล้วว่างเปล่า เพราะยังไม่มีอะไรเขียนลงตาราง notifications เลย
 *
 * **หน้าจอที่บอกตัวเลขผิดแย่กว่าหน้าจอที่ไม่บอกอะไรเลย** เพราะคนใช้จะเลิกเชื่อทั้งระบบ
 * ถ้าจะใส่กลับ ต้องดึงจากของจริงเท่านั้น ห้ามเขียนเลขตายลงในไฟล์นี้อีก
 */
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'งานของฉัน',
    items: [
      { href: '', icon: '⌂', label: 'หน้าแรก' },
      { href: '/my', icon: '☑', label: 'งานที่ได้รับ' },
      { href: '/calendar', icon: '▤', label: 'ปฏิทินกำหนดส่ง' },
      { href: '/notifications', icon: '◉', label: 'การแจ้งเตือน' },
    ],
  },
  {
    label: 'ทีม',
    items: [
      { href: '/projects', icon: '▦', label: 'โปรเจกต์' },
      { href: '/team', icon: '⚇', label: 'ภาพรวมทีม' },
      { href: '/activity', icon: '◷', label: 'กิจกรรม' },
      { href: '/search', icon: '🔍', label: 'ค้นหา' },
    ],
  },
  {
    label: 'ลูกค้า',
    items: [
      { href: '/clients', icon: '◍', label: 'ลูกค้า' },
      { href: '/sla', icon: '⏱', label: 'งานประกัน / SLA' },
      { href: '/sla/triage', icon: '⑃', label: 'คิวคัดแยก' },
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
      { href: '/me', icon: '☺', label: 'โปรไฟล์ของฉัน' },
      { href: '/limits', icon: '◮', label: 'โควตาและแผน' },
      { href: '/settings', icon: '⚙', label: 'ตั้งค่าที่ทำงาน' },
    ],
  },
];

interface NavItem {
  href: string;
  icon: string;
  label: string;
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
                // biome-ignore lint/a11y/useValidAnchor: เมนูที่ยังไม่เปิดใช้ ตั้งใจไม่ให้มี href · CSS ของต้นแบบผูกกับ ".side nav a" เปลี่ยนเป็น span แล้วเสียรูป
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
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
