import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // เทสต์หน่วยอยู่ข้างไฟล์ที่มันทดสอบ · เทสต์ e2e เป็นของ Playwright แยกต่างหาก
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
