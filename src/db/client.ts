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

/**
 * ต่อฐานข้อมูลตอนใช้จริงครั้งแรก ไม่ใช่ตอน import
 *
 * `next build` ประเมินโมดูลของทุก route ตอนเก็บข้อมูลหน้า ถ้าเชื่อมตั้งแต่ import
 * build จะพังทันทีบนเครื่องที่ยังไม่ได้ตั้ง DATABASE_URL เช่นบน CI
 * และแอปจะเปิดคอนเนกชันทิ้งไว้ทั้งที่ยังไม่มีใครเรียกสักคำขอ
 *
 * พูลตั้งไว้ 8 ตัว ให้พอดีกับ max_connections=25 ของ Postgres
 * เหลือที่ให้ migration และเครื่องมืออื่นเข้ามาได้โดยไม่ชนกัน
 */
let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function connect() {
  if (dbInstance && client) return { client, db: dbInstance };
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('ไม่ได้ตั้ง DATABASE_URL');
  client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 8),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  dbInstance = drizzle(client, { schema });
  return { client, db: dbInstance };
}

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/** ใช้เหมือน db ปกติ แต่ต่อจริงตอนแตะครั้งแรก */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const target = connect().db as unknown as Record<string | symbol, unknown>;
    const v = target[prop];
    return typeof v === 'function' ? v.bind(target) : v;
  },
});
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
 * ธุรกรรมที่ไม่ผูกกับที่ทำงานเลย — ใช้กับเส้นทางยืนยันตัวตนที่ยังไม่รู้ว่าใครเป็นใคร
 * (สมัคร · เข้าสู่ระบบ · ลืมรหัส · ตั้งรหัสใหม่)
 *
 * ตารางที่เปิด RLS คืน 0 แถวเสมอในธุรกรรมนี้ เพราะไม่ได้ตั้งทั้ง app.tenant_id
 * และ app.user_id จึงแตะได้แค่ users กับ sessions ซึ่งไม่มี RLS
 */
export async function withoutTenant<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

/**
 * ธุรกรรมระดับบัญชี — สำหรับสี่ endpoint ที่ข้าม tenant ได้ตามกฎข้อ 11
 *   GET /me/workspaces · GET /me/invitations
 *   POST /workspaces · POST /invitations/:token/accept
 *
 * ตั้ง app.user_id และ app.user_email แต่ **ไม่ตั้ง app.tenant_id**
 * policy จึงเปิดให้เห็นเฉพาะแถวที่เป็นของคนคนนี้เอง ไม่ใช่ทั้งที่ทำงาน
 *
 * ห้ามใช้แทน withTenant() เด็ดขาด — ถ้าตั้งทั้งสองค่าพร้อมกัน
 * ที่ทำงานหนึ่งจะเห็นได้ว่าสมาชิกของตัวเองไปอยู่ที่ทำงานไหนอีกบ้าง
 */
export async function withAccount<T>(
  userId: string,
  email: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`select set_config('app.user_email', ${email}, true)`);
    return fn(tx);
  });
}

/**
 * สร้างที่ทำงานใหม่ — ต้องสลับ app.tenant_id กลางธุรกรรมหลังจากมี id แล้ว
 * ใช้ที่ POST /auth/signup และ POST /workspaces เท่านั้น
 */
export async function withNewTenant<T>(
  fn: (tx: Tx, enterTenant: (tenantId: string) => Promise<void>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const enter = async (tenantId: string) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    };
    return fn(tx, enter);
  });
}

export async function closeDb(): Promise<void> {
  if (client) await client.end({ timeout: 5 });
  client = null;
  dbInstance = null;
}
