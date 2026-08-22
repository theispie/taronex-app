import { checkDatabase } from '@/db/health';
import { ok } from '@/lib/api/respond';

/**
 * GET /api/v1/meta/health — เครื่องยังตอบอยู่ไหม
 *
 * ไม่แตะฐานข้อมูล ไม่ต้องล็อกอิน ไม่คืนข้อมูลผู้ใช้
 * ตัวเลขหน่วยความจำอยู่ในนี้เพราะเครื่องมี 512 MB และ swap คือสิ่งที่พยุงอยู่
 * ต่อฐานข้อมูลจริงแล้วตั้งแต่ M1 — ถ้ายังไม่ตั้ง DATABASE_URL จะรายงานว่า "ยังไม่ได้ต่อ"
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const mem = process.memoryUsage();
  const database = await checkDatabase();
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
      // เก็บเป็นข้อความทั้งหมดเพื่อให้รูปร่างของ checks เรียบ ฝั่งหน้าจอวาดเป็นป้ายได้เลย
      database:
        database.status === 'ok'
          ? `ok · ${database.version} · ${database.latencyMs} ms`
          : database.status,
      storage: 'ยังไม่ได้ต่อ',
      queue: 'ยังไม่ได้ต่อ',
      mail: 'ยังไม่ได้ต่อ',
    },
  });
}
