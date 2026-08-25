import type { Metadata } from 'next';
import { LocaleProvider } from '@/lib/i18n';
import { serverLocale } from '@/lib/i18n/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaroNex',
  description: 'ระบบจัดการโปรเจกต์สำหรับทีมที่ต้องดูแลลูกค้าหลังส่งมอบ',
};

/**
 * ภาษาอ่านที่นี่ที่เดียวแล้วส่งลงไปทั้งต้นไม้
 *
 * อ่านฝั่งเซิร์ฟเวอร์เพราะรู้ภาษาตั้งแต่ก่อนส่ง HTML ออกไป
 * ถ้าให้ฝั่งเบราว์เซอร์อ่านคุกกี้เอง หน้าจะวาดด้วยภาษาผิดก่อนแล้วค่อยกระพริบเปลี่ยน
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await serverLocale();

  return (
    <html lang={locale}>
      <head>
        {/* ฟอนต์เดียวกับต้นแบบ — IBM Plex Sans Thai */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
