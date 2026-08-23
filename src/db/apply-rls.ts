/**
 * รัน db/rls.sql — RLS · role `app` · trigger
 *
 * เขียนเป็นสคริปต์แทนการเรียก psql เพราะ psql ไม่ได้มีอยู่ทุกเครื่อง
 * และไม่อยากให้ขั้นตอนสำคัญที่สุดของความปลอดภัยขึ้นกับว่าเครื่องนั้นลงอะไรไว้บ้าง
 *
 * ไฟล์ SQL เขียนให้รันซ้ำได้เสมอ จึงรันหลัง migrate ทุกครั้งได้โดยไม่ต้องเช็คอะไร
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const url =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

async function main() {
  const file = path.join(process.cwd(), 'db', 'rls.sql');
  const script = await readFile(file, 'utf8');
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe(script);
    console.log('ใช้ db/rls.sql เรียบร้อย');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
