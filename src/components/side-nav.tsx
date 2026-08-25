'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DictKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n';

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
const GROUPS: { label: DictKey; items: NavItem[] }[] = [
  {
    label: 'nav.myWork',
    items: [
      { href: '', icon: '⌂', label: 'nav.home' },
      { href: '/my', icon: '☑', label: 'nav.myTasks' },
      { href: '/calendar', icon: '▤', label: 'nav.calendar' },
      { href: '/notifications', icon: '◉', label: 'nav.notifications' },
    ],
  },
  {
    label: 'nav.team',
    items: [
      { href: '/projects', icon: '▦', label: 'nav.projects' },
      { href: '/team', icon: '⚇', label: 'nav.teamOverview' },
      { href: '/activity', icon: '◷', label: 'nav.activity' },
      // ไม่มี "ค้นหา" ในเมนู — ช่องค้นหาอยู่บนแถบบนของทุกหน้าอยู่แล้ว
      // เมนูที่ซ้ำกับสิ่งที่เห็นอยู่ตรงหน้าทำให้เมนูยาวขึ้นโดยไม่ได้อะไรเพิ่ม
      // (หน้า /search ยังอยู่ ยังเข้าได้จากช่องค้นหาและลิงก์ตรง)
    ],
  },
  {
    label: 'nav.clientsGroup',
    items: [
      { href: '/clients', icon: '◍', label: 'nav.clients' },
      { href: '/sla', icon: '⏱', label: 'nav.sla' },
      { href: '/sla/triage', icon: '⑃', label: 'nav.triage' },
    ],
  },
  {
    label: 'nav.later',
    items: [
      { href: '', icon: '◔', label: 'nav.timeLog', soon: 'v3' },
      { href: '', icon: '▥', label: 'nav.reports', soon: 'v3' },
    ],
  },
  {
    label: 'nav.settingsGroup',
    items: [
      { href: '/templates', icon: '▤', label: 'nav.templates' },
      { href: '/me', icon: '☺', label: 'nav.myProfile' },
      { href: '/limits', icon: '◮', label: 'nav.limits' },
      { href: '/settings', icon: '⚙', label: 'nav.workspaceSettings' },
    ],
  },
];

interface NavItem {
  href: string;
  icon: string;
  label: DictKey;
  soon?: string;
}

export function SideNav({ base }: { base: string }) {
  const path = usePathname();
  const { t } = useT();

  return (
    <nav>
      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="lb">{t(g.label)}</div>
          {g.items.map((it) => {
            const href = `${base}${it.href}`;
            const active = it.soon ? false : path === href;
            if (it.soon) {
              return (
                // biome-ignore lint/a11y/useValidAnchor: เมนูที่ยังไม่เปิดใช้ ตั้งใจไม่ให้มี href · CSS ของต้นแบบผูกกับ ".side nav a" เปลี่ยนเป็น span แล้วเสียรูป
                <a key={it.label} aria-disabled className="soon-row">
                  <span className="ic">{it.icon}</span>
                  {t(it.label)}
                  <span className="soon">{it.soon}</span>
                </a>
              );
            }
            return (
              <Link key={it.label} href={href} className={active ? 'on' : ''}>
                <span className="ic">{it.icon}</span>
                {t(it.label)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
