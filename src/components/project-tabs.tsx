'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ProjectTabs({ base, warranty }: { base: string; warranty?: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: '', label: 'ภาพรวม' },
    { href: '/board', label: 'บอร์ด' },
    { href: '/list', label: 'ตาราง' },
    // เฟสประกัน = การวางแผนจบแล้ว Timeline จึงหายไป มีแท็บงานประกันแทน
    ...(warranty ? [] : [{ href: '/timeline', label: 'Timeline' }]),
    { href: '/features', label: 'งานหลัก' },
    { href: '/phases', label: 'เฟส' },
    { href: '/files', label: 'ไฟล์' },
    { href: '/members', label: 'ทีมงาน' },
    { href: '/access', label: 'สิทธิ์' },
  ];
  return (
    <div className="tabs" style={{ marginBottom: 16 }}>
      {tabs.map((t) => (
        <Link key={t.label} href={`${base}${t.href}`}
              className={path === `${base}${t.href}` ? 'on' : ''}>{t.label}</Link>
      ))}
    </div>
  );
}
