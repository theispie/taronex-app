import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // เทสต์หน่วยอยู่ข้างไฟล์ที่มันทดสอบ · เทสต์ e2e เป็นของ Playwright แยกต่างหาก
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],

    /**
     * ⭐ ห้ามรันไฟล์เทสต์ขนานกัน — ทุกไฟล์ใช้ฐาน `taronex_test` ใบเดียวกัน
     *
     * เทสต์ที่แตะฐานสั่ง `TRUNCATE … CASCADE` ใน `beforeEach` ซึ่งต้องได้
     * AccessExclusiveLock ทุกตาราง พอมีอีกไฟล์กำลัง INSERT อยู่ (RowExclusiveLock)
     * สองฝั่งรอกันแล้ว Postgres ตัดด้วย `deadlock detected` (40P01)
     *
     * ═══ ทำไมไม่เคยพังบนเครื่องนี้ ═══
     * เครื่องจริงมี 1 vCPU · vitest จึงใช้ worker เดียวและรันทีละไฟล์อยู่แล้ว
     * แต่ GitHub Actions runner มีหลายคอร์ → รันขนาน → ตก 141 ข้อจาก 284
     * **เป็นบั๊กที่มองไม่เห็นเลยจนกว่าจะไปรันบนเครื่องที่มีหลายคอร์**
     *
     * ทางแก้ที่ผิดคือแยกฐานต่อ worker — เพิ่มความซับซ้อนโดยไม่ได้อะไร
     * เทสต์ชุดนี้ใช้เวลาไม่ถึงนาที การรันเรียงกันจึงไม่ใช่ต้นทุนที่ต้องแลก
     */
    fileParallelism: false,
    environment: 'node',
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
