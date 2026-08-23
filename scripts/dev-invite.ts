/**
 * ออกลิงก์คำเชิญจากบรรทัดคำสั่ง — ใช้ตอนพัฒนาเท่านั้น
 *
 * ยังไม่ได้ต่อ Resend คำเชิญจึงยังส่งอีเมลจริงไม่ได้
 * ตัวนี้ออกโทเคนแล้วพิมพ์ลิงก์ให้เอาไปเปิดในเบราว์เซอร์ได้เลย
 *
 *   pnpm dev:invite <รหัสที่ทำงาน> <อีเมล> [บทบาท]
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Tx } from '../src/db/client';
import * as s from '../src/db/schema';
import { inviteMember, type Role } from '../src/lib/auth/accounts';

const url = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const [slug, email, roleArg] = process.argv.slice(2);

async function main() {
  if (!slug || !email) {
    console.error('ใช้: pnpm dev:invite <รหัสที่ทำงาน> <อีเมล> [owner|member|viewer|guest]');
    process.exit(1);
  }
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });
  try {
    const t = await db.execute<{ id: string }>(sql`select id from tenants where slug = ${slug}`);
    const tenantId = [...t][0]?.id;
    if (!tenantId) throw new Error(`ไม่พบที่ทำงาน ${slug}`);

    const token = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      const u = await tx.execute<{ id: string }>(
        sql`select user_id as id from memberships where role = 'owner' limit 1`,
      );
      const owner = [...u][0]?.id;
      if (!owner) throw new Error('ที่ทำงานนี้ไม่มีเจ้าของ');
      return inviteMember(tx as unknown as Tx, tenantId, owner, {
        email,
        role: (roleArg as Role) ?? 'member',
        jobTitle: 'other',
      });
    });
    console.log(`/app/invite/${token}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
