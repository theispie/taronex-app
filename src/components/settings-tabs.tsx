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
      {TABS.map((t) =>
        t.disabled ? (
          // biome-ignore lint/a11y/useValidAnchor: แท็บที่ยังกดไม่ได้ ตั้งใจไม่ให้มี href · CSS ของต้นแบบผูกกับ ".tabs a" เปลี่ยนเป็น span แล้วเสียรูป
          <a key={t.href} style={{ opacity: 0.5, cursor: 'default' }}>{t.label}</a>
        ) : (
          <Link key={t.href} href={`${base}/settings${t.href}`}
                className={path === `${base}/settings${t.href}` ? 'on' : ''}>
            {t.label}
          </Link>
        ),
      )}
    </div>
  );
}
