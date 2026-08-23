import { defineConfig } from '@playwright/test';

/**
 * เทสต์ที่พิสูจน์ว่าเข้าข้อมูลข้ามที่ทำงานไม่ได้อยู่ที่นี่
 * CLAUDE.md กำหนดว่าต้องได้ 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่าข้อมูลนั้นมีอยู่จริง
 *
 * ลงเฉพาะ chromium · firefox กับ webkit ไม่คุ้มดิสก์บนเครื่องนี้
 * และสิ่งที่เทสต์คือกติกาฝั่งเซิร์ฟเวอร์ ไม่ใช่ความต่างของเบราว์เซอร์
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // เครื่อง 1 vCPU · ขนานแล้วช้ากว่าเดิม
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    // origin เท่านั้น ไม่ใส่ /app — Playwright แปลง path ที่ขึ้นต้นด้วย /
    // เทียบกับ origin ของ baseURL แล้วตัด path ของ baseURL ทิ้ง
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { channel: 'chromium' } }],
});
