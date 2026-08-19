'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'ทั่วไป' },
  { href: '/members', label: 'สมาชิก' },
  { href: '/roles', label: 'บทบาทและสิทธิ์' },
  { href: '', label: 'เวลาทำการ', disabled: true },
  { href: '', label: 'แผนและการชำระเงิน', disabled: true },
];

export function SettingsTabs({ base }: { base: string }) {
  const path = usePathname();
  return (
    <div className="tabs" style={{ marginBottom: 16 }}>
      {TABS.map((t, i) =>
        t.disabled ? (
          <a key={i} style={{ opacity: 0.5, cursor: 'default' }}>{t.label}</a>
        ) : (
          <Link key={i} href={`${base}/settings${t.href}`}
                className={path === `${base}/settings${t.href}` ? 'on' : ''}>
            {t.label}
          </Link>
        ),
      )}
    </div>
  );
}
