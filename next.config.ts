import type { NextConfig } from 'next';

const config: NextConfig = {
  // เสิร์ฟใต้ https://taronex.theerawut.com/app
  basePath: '/app',
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // กันรหัสที่ทำงานรั่วไปเว็บอื่นผ่าน Referer
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
