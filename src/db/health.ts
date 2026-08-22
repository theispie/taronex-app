/**
 * ตรวจว่าฐานข้อมูลตอบไหม — ใช้ที่ /api/v1/meta/health
 *
 * แยกออกมาจาก client.ts และเปิดคอนเนกชันของตัวเองแบบ max: 1
 * เพราะถ้า import client.ts ตรงๆ แล้วเครื่องยังไม่ได้ตั้ง DATABASE_URL
 * ทั้งแอปจะพังตั้งแต่ตอนโหลดโมดูล ซึ่งแย่กว่าการรายงานว่า "ยังไม่ได้ต่อ"
 */

import postgres from 'postgres';

export interface DbHealth {
  status: 'ok' | 'ยังไม่ได้ต่อ' | 'ต่อไม่ได้';
  version?: string;
  latencyMs?: number;
  detail?: string;
}

export async function checkDatabase(): Promise<DbHealth> {
  const url = process.env.DATABASE_URL;
  if (!url) return { status: 'ยังไม่ได้ต่อ' };

  const client = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
  const t0 = performance.now();
  try {
    const rows = await client`select version() as v`;
    const v = String(rows[0]?.v ?? '');
    return {
      status: 'ok',
      // เอาแค่ "PostgreSQL 17.11" ไม่ต้องพ่วงชื่อคอมไพเลอร์ออกไป
      version: v.split(' ').slice(0, 2).join(' '),
      latencyMs: Math.round(performance.now() - t0),
    };
  } catch (e) {
    return { status: 'ต่อไม่ได้', detail: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ' };
  } finally {
    await client.end({ timeout: 2 }).catch(() => {});
  }
}
