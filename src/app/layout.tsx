import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaroNex',
  description: 'ระบบจัดการโปรเจกต์สำหรับทีมที่ต้องดูแลลูกค้าหลังส่งมอบ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        {/* ฟอนต์เดียวกับต้นแบบ — IBM Plex Sans Thai */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
