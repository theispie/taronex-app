import { defineConfig } from 'drizzle-kit';

/**
 * migration ใช้ DATABASE_MIGRATION_URL ซึ่งเป็นเจ้าของตาราง
 * ไม่ใช่ DATABASE_URL ที่แอปใช้ (role `app` ซึ่ง NOBYPASSRLS และไม่ใช่เจ้าของ) — กฎข้อ 1
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex',
  },
  strict: true,
  verbose: true,
});
