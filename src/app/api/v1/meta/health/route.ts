import { ok } from '@/lib/api/respond';

/**
 * GET /api/v1/meta/health — เครื่องยังตอบอยู่ไหม
 *
 * ไม่แตะฐานข้อมูล ไม่ต้องล็อกอิน ไม่คืนข้อมูลผู้ใช้
 * ตัวเลขหน่วยความจำอยู่ในนี้เพราะเครื่องมี 512 MB และ swap คือสิ่งที่พยุงอยู่
 * ตอนต่อฐานข้อมูล (M1) ให้เพิ่มผลตรวจ SELECT 1 ลงใน checks
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  const mem = process.memoryUsage();
  return ok({
    status: 'ok',
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    memory: {
      rssMb: Math.round(mem.rss / 1048576),
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
    },
    checks: {
      web: 'ok',
      database: 'ยังไม่ได้ต่อ',
      storage: 'ยังไม่ได้ต่อ',
      queue: 'ยังไม่ได้ต่อ',
      mail: 'ยังไม่ได้ต่อ',
    },
  });
}
