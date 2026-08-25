/**
 * ข้อเท็จจริงจากฐานข้อมูลจริง — คนละเรื่องกับผังในโค้ด
 *
 * ═══ ทำไมต้องมีสองด้าน ═══
 * ผังในโค้ดบอกว่า "ตั้งใจให้เป็นแบบนี้" · ฐานจริงบอกว่า "ตอนนี้เป็นแบบนี้"
 * สองอย่างนี้ไม่ตรงกันได้ — migration ยังไม่ได้รัน · `db/rls.sql` ยังไม่ได้ลง ·
 * มีคนแก้ที่ฐานตรงๆ · หรือชี้ไปคนละฐาน
 *
 * หน้าภายในต้องแสดง**ทั้งสองด้านคู่กัน** ไม่งั้นจะเห็นแต่ความตั้งใจแล้วนึกว่าของจริงเป็นแบบนั้น
 * ซึ่งเป็นวิธีที่ทำให้ RLS หลุดโดยไม่มีใครรู้
 */

import { sql } from 'drizzle-orm';
import { withoutTenant } from '@/db/client';

export interface LiveTable {
  name: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: number;
  /** จำนวนแถวโดยประมาณจากตัววางแผนคำสั่ง — ไม่ COUNT(*) จริงเพราะตารางใหญ่จะช้า */
  approxRows: number;
}

export interface LiveDb {
  ok: boolean;
  error: string | null;
  database: string;
  version: string;
  sizePretty: string;
  appRole: { exists: boolean; superuser: boolean; bypassRls: boolean } | null;
  /** null = อ่านไม่ได้ (ไม่ใช่ 0) — role app ไม่มีสิทธิ์อ่าน schema drizzle ซึ่งถูกแล้ว */
  migrations: number | null;
  triggers: string[];
  tables: LiveTable[];
}

/**
 * นับ migration แยกธุรกรรมของตัวเอง
 *
 * `drizzle.__drizzle_migrations` เป็นของเจ้าของฐาน role `app` อ่านไม่ได้ — **และนั่นถูกแล้ว**
 * แต่คำสั่งที่ล้มใน Postgres ทำให้ทั้งธุรกรรมเป็นโมฆะ ถ้าถามในธุรกรรมเดียวกับที่เหลือ
 * ข้อมูลอื่นที่อ่านสำเร็จไปแล้วจะหายไปด้วย (เจอมาแล้ว — หน้ากลายเป็น "ต่อฐานข้อมูลไม่ได้" ทั้งหน้า)
 */
async function countMigrations(): Promise<number | null> {
  try {
    return await withoutTenant(async (tx) => {
      const mig = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
      );
      return [...mig][0]?.n ?? 0;
    });
  } catch {
    return null;
  }
}

export async function readLiveDb(): Promise<LiveDb> {
  const empty: LiveDb = {
    ok: false,
    error: null,
    database: '—',
    version: '—',
    sizePretty: '—',
    appRole: null,
    migrations: null,
    triggers: [],
    tables: [],
  };

  const migrations = await countMigrations();

  try {
    return await withoutTenant(async (tx) => {
      const meta = await tx.execute<{
        db: string;
        version: string;
        size: string;
      }>(sql`
        select current_database() as db,
               current_setting('server_version') as version,
               pg_size_pretty(pg_database_size(current_database())) as size
      `);
      const m = [...meta][0];

      const rows = await tx.execute<{
        name: string;
        rls_enabled: boolean;
        rls_forced: boolean;
        policies: number;
        approx_rows: number;
      }>(sql`
        select c.relname as name,
               c.relrowsecurity as rls_enabled,
               c.relforcerowsecurity as rls_forced,
               (select count(*)::int from pg_policies p
                 where p.schemaname = 'public' and p.tablename = c.relname) as policies,
               greatest(c.reltuples, 0)::int as approx_rows
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
         order by c.relname
      `);

      const role = await tx.execute<{
        rolsuper: boolean;
        rolbypassrls: boolean;
      }>(sql`select rolsuper, rolbypassrls from pg_roles where rolname = 'app'`);
      const r = [...role][0];

      // ไม่นับ trigger ของ foreign key ที่ Postgres สร้างเอง — เอาเฉพาะที่เราเขียน
      const trg = await tx.execute<{ tgname: string }>(sql`
        select distinct t.tgname
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and not t.tgisinternal
         order by t.tgname
      `);

      return {
        ok: true,
        error: null,
        database: m?.db ?? '—',
        version: m?.version ?? '—',
        sizePretty: m?.size ?? '—',
        appRole: r ? { exists: true, superuser: r.rolsuper, bypassRls: r.rolbypassrls } : null,
        migrations,
        triggers: [...trg].map((x) => x.tgname),
        tables: [...rows].map((x) => ({
          name: x.name,
          rlsEnabled: x.rls_enabled,
          rlsForced: x.rls_forced,
          policies: x.policies,
          approxRows: x.approx_rows,
        })),
      };
    });
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'ต่อฐานข้อมูลไม่ได้' };
  }
}
