/**
 * ออกลิงก์เข้าพอร์ทัลจากบรรทัดคำสั่ง — ใช้ตอนพัฒนาเท่านั้น
 *
 * ยังไม่ได้ต่อ Resend ลิงก์จึงยังส่งอีเมลจริงไม่ได้
 * ตัวนี้ออกโทเคนแล้วพิมพ์ลิงก์ให้เอาไปเปิดในเบราว์เซอร์ได้เลย
 *
 *   pnpm dev:portal-link <รหัสที่ทำงาน> <อีเมลผู้ติดต่อ>
 *
 * ⚠ ตั้งใจไม่ทำเป็น endpoint — ถ้ามีเส้นทาง HTTP ที่คืนโทเคนได้
 * วันหนึ่งจะมีคนเปิดมันบนเครื่องจริง แล้วใครก็ได้จะเข้าพอร์ทัลของลูกค้าคนไหนก็ได้
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Tx } from '../src/db/client';
import * as s from '../src/db/schema';
import { requestLink } from '../src/lib/portal/intake';

const url = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const [slug, email] = process.argv.slice(2);

async function main() {
  if (!slug || !email) {
    console.error('ใช้: pnpm dev:portal-link <รหัสที่ทำงาน> <อีเมลผู้ติดต่อ>');
    process.exit(1);
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });
  try {
    const t = await db.execute<{ id: string }>(sql`select id from tenants where slug = ${slug}`);
    const tenantId = [...t][0]?.id;
    if (!tenantId) throw new Error(`ไม่พบที่ทำงาน ${slug}`);

    const link = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      return requestLink(tx as unknown as Tx, tenantId, email);
    });
    if (!link) throw new Error(`${email} ไม่ได้เป็นผู้ติดต่อของที่ทำงานนี้`);

    const base = process.env.APP_URL ?? 'http://localhost:3000';
    console.log(`\n${link.name} · ${email}`);
    console.log(`${base}/portal/${slug}/login?token=${link.token}\n`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
