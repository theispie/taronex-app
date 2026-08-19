import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaroNex',
  description: 'ระบบจัดการโปรเจกต์สำหรับทีมที่ต้องดูแลลูกค้าหลังส่งมอบ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
