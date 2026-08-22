/**
 * ทางเดียวที่แอปคุยกับฐานข้อมูล
 *
 * ═══ กฎข้อ 2 และ 3 อยู่ที่ไฟล์นี้ทั้งหมด ═══
 *
 * ทุกธุรกรรมต้อง set_config('app.tenant_id', …, **true**) ก่อนคำสั่งแรก
 * ตัวที่สาม `true` คือ LOCAL — ผูกค่ากับธุรกรรม พอ COMMIT/ROLLBACK ค่าหายไปเอง
 *
 * ถ้าลืม `true` ค่าจะติดค้างกับ connection แล้ว request ถัดไปที่หยิบ
 * connection เดิมจากพูลจะเห็นข้อมูลของ tenant ก่อนหน้า
 * **นี่คือช่องโหว่ที่ร้ายแรงที่สุดที่เป็นไปได้ และจะไม่พังตอนทดสอบ
 * เพราะเครื่อง dev มักมี connection เดียว**
 *
 * ห้ามมี route ไหนเปิดธุรกรรมเองนอกทางนี้ และห้ามเขียน
 * `WHERE tenant_id = ?` เองเป็นการป้องกันหลัก — RLS คือด่านจริง
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('ไม่ได้ตั้ง DATABASE_URL');

/**
 * พูลตั้งไว้ 8 ตัว ให้พอดีกับ max_connections=25 ของ Postgres
 * เหลือที่ให้ migration และเครื่องมืออื่นเข้ามาได้โดยไม่ชนกัน
 */
const client = postgres(url, {
  max: Number(process.env.DB_POOL_MAX ?? 8),
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
/** ตัวจับธุรกรรมที่ส่งให้ callback — มี API เหมือน db */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * เปิดธุรกรรมที่ผูกกับที่ทำงานหนึ่งแห่ง
 * ทุก query ข้างในถูก RLS กรองให้อัตโนมัติ ไม่ต้องเขียนเงื่อนไขเอง
 */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // true = LOCAL · ห้ามเอาออกเด็ดขาด ดูคำอธิบายหัวไฟล์
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

/**
 * ธุรกรรมที่ได้รับอนุญาตให้ย้ายคอลัมน์ของการ์ด
 * ใช้ที่ POST /tasks/:id/transition ที่เดียวเท่านั้น (กฎข้อ 4)
 * trigger guard_task_column จะปฏิเสธการแก้ column_key จากทางอื่นทั้งหมด
 */
export async function withColumnMove<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
    return fn(tx);
  });
}

/**
 * ธุรกรรมที่ได้รับอนุญาตให้เปลี่ยนสถานะที่ลูกค้าเห็น
 * ใช้ที่ POST /tasks/:id/portal-stage ที่เดียวเท่านั้น
 */
export async function withPortalStageChange<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_portal_stage', 'on', true)`);
    return fn(tx);
  });
}

/**
 * ธุรกรรมที่ไม่ผูกกับที่ทำงาน — ใช้ได้เฉพาะสี่ endpoint ตามกฎข้อ 11
 * และเส้นทางยืนยันตัวตนที่ยังไม่รู้ว่าผู้ใช้อยู่ที่ทำงานไหน
 *
 * ตารางที่เปิด RLS จะคืน 0 แถวเสมอในธุรกรรมนี้ เพราะไม่ได้ตั้ง app.tenant_id
 * จึงแตะได้แค่ users, sessions และ memberships ที่ join จาก user_id ของ session
 */
export async function withoutTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

export async function closeDb(): Promise<void> {
  await client.end({ timeout: 5 });
}
