/**
 * สร้างฐานข้อมูลสำหรับเทสต์ให้พร้อมใช้
 *
 * แยกฐานคนละใบกับเว็บจริง เพราะเทสต์สั่ง TRUNCATE ทุกตาราง
 * (ดูเหตุผลเต็มใน `src/test/db.ts`)
 *
 * รันซ้ำได้เสมอ — มีอยู่แล้วก็ข้ามไป
 */

import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

const TEST_DB = process.env.TEST_DB_NAME ?? 'taronex_test';
const ADMIN_URL =
  process.env.TEST_ADMIN_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/postgres';

async function main() {
  if (!TEST_DB.endsWith('_test')) {
    throw new Error(`ชื่อฐานทดสอบต้องลงท้ายด้วย _test · ได้ "${TEST_DB}"`);
  }

  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${TEST_DB}`;
  if (exists.length === 0) {
    // ชื่อฐานใส่เป็นพารามิเตอร์ไม่ได้ · ตรวจรูปแบบเองก่อนต่อสตริง
    if (!/^[a-z0-9_]+$/.test(TEST_DB)) throw new Error('ชื่อฐานมีอักขระที่ไม่อนุญาต');
    await admin.unsafe(`create database ${TEST_DB}`);
    console.info(`สร้างฐาน ${TEST_DB} แล้ว`);
  } else {
    console.info(`ฐาน ${TEST_DB} มีอยู่แล้ว`);
  }
  await admin.end({ timeout: 5 });

  const owner = ADMIN_URL.replace(/\/[^/]*$/, `/${TEST_DB}`);
  const app = owner.replace('postgres:devonly', 'app:devonly');

  const env = {
    ...process.env,
    DATABASE_MIGRATION_URL: owner,
    DATABASE_URL: app,
  };
  console.info('ลงสคีมา…');
  execFileSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], { stdio: 'inherit', env });
  console.info('ลง RLS · trigger · สิทธิ์ของ role app…');
  execFileSync('pnpm', ['db:rls'], { stdio: 'inherit', env });
  console.info(`\nพร้อมใช้ · เทสต์จะต่อไปที่ ${TEST_DB} โดยอัตโนมัติ`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
