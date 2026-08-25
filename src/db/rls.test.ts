/**
 * เทสต์การแยกข้อมูลข้ามที่ทำงาน — เทสต์ชุดที่สำคัญที่สุดในระบบนี้
 *
 * ทุกข้อในนี้ทดสอบกฎที่ "ผิดแล้วเงียบ" — ไม่มีอะไรพัง ไม่มี error
 * แค่ข้อมูลของบริษัทหนึ่งโผล่ให้อีกบริษัทเห็น
 *
 * ข้อที่สำคัญที่สุดคือ "พูลขนาด 1 สลับที่ทำงานติดกัน"
 * ถ้าใครเผลอเอา LOCAL ออกจาก set_config เทสต์ข้ออื่นจะยังเขียวหมด
 * มีข้อนั้นข้อเดียวที่จับได้
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import * as s from './schema';
import { seed } from './seed';

/** พูลขนาด 1 โดยตั้งใจ — บังคับให้ทุก query ใช้ connection เดียวกัน */
const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantA = '';
let tenantB = '';

/** เปิดธุรกรรมแบบเดียวกับ withTenant() ในโค้ดจริง */
async function asTenant<T>(id: string, fn: (tx: typeof appDb) => Promise<T>): Promise<T> {
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${id}, true)`);
    return fn(tx as unknown as typeof appDb);
  });
}

/**
 * drizzle ห่อข้อผิดพลาดของฐานข้อมูลไว้เป็น "Failed query: …" แล้วเก็บของจริงไว้ที่ .cause
 * ถ้าเทียบกับ error.message ตรงๆ regex จะไปตรงกับ "ข้อความ SQL" แทนที่จะเป็นข้อความจาก trigger
 * ซึ่งทำให้เทสต์ผ่านทั้งที่ไม่ได้พิสูจน์อะไรเลย — ต้องไล่ตาม cause ให้สุดสาย
 */
async function expectDbError(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await fn();
  } catch (e) {
    caught = e;
  }
  expect(caught, 'คาดว่าจะโยนข้อผิดพลาด แต่ผ่านไปได้').toBeDefined();

  const parts: string[] = [];
  let cur: unknown = caught;
  for (let i = 0; i < 5 && cur instanceof Error; i++) {
    parts.push(cur.message);
    cur = (cur as { cause?: unknown }).cause;
  }
  const full = parts.join(' | ');
  expect(full, `ข้อผิดพลาดไม่ตรงกับที่คาด: ${full}`).toMatch(pattern);
}

beforeAll(async () => {
  // เทสต์ในไฟล์นี้แก้ข้อมูลจริง (ย้ายคอลัมน์ · ตั้งสถานะพอร์ทัล · เขียนเหตุการณ์)
  // ถ้าไม่ล้างก่อน รอบถัดไปจะทำงานบนข้อมูลที่รอบก่อนแก้ค้างไว้แล้วตกแบบงงๆ
  await seed(ownerDb);

  const rows = await ownerDb.execute<{ id: string; slug: string }>(
    sql`select id, slug from tenants order by slug`,
  );
  const list = [...rows];
  if (list.length < 2) throw new Error('ต้องรัน pnpm db:seed ก่อน');
  tenantA = list[0]?.id ?? '';
  tenantB = list[1]?.id ?? '';
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

describe('กฎข้อ 1 · RLS เปิดครบทุกตารางที่มี tenant_id', () => {
  it('ทุกตารางเปิดทั้ง RLS และ FORCE', async () => {
    const rows = await ownerDb.execute<{ tablename: string; rls: boolean; forced: boolean }>(sql`
      select c.relname as tablename, c.relrowsecurity as rls, c.relforcerowsecurity as forced
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (
          select 1 from information_schema.columns col
          where col.table_name = c.relname and col.column_name = 'tenant_id'
        )
    `);
    const bad = [...rows].filter((r) => !r.rls || !r.forced).map((r) => r.tablename);
    expect(bad, 'ตารางที่มี tenant_id แต่ยังไม่เปิด RLS+FORCE').toEqual([]);
    expect([...rows].length).toBeGreaterThanOrEqual(21);
  });

  it('role app เป็น NOBYPASSRLS และไม่ใช่ superuser', async () => {
    const rows = await ownerDb.execute<{ rolbypassrls: boolean; rolsuper: boolean }>(
      sql`select rolbypassrls, rolsuper from pg_roles where rolname = 'app'`,
    );
    const r = [...rows][0];
    expect(r, 'ไม่มี role app').toBeDefined();
    expect(r?.rolbypassrls).toBe(false);
    expect(r?.rolsuper).toBe(false);
  });
});

describe('กฎข้อ 2 · ไม่ตั้ง app.tenant_id แล้วต้องไม่เห็นอะไรเลย', () => {
  it('query โดยไม่ตั้งค่า คืน 0 แถว', async () => {
    const rows = await appDb.execute<{ n: number }>(sql`select count(*)::int as n from tasks`);
    expect([...rows][0]?.n).toBe(0);
  });

  it('ตารางอื่นก็เหมือนกัน ไม่ใช่แค่ tasks', async () => {
    for (const t of ['projects', 'clients', 'comments', 'task_events']) {
      const rows = await appDb.execute<{ n: number }>(
        sql`select count(*)::int as n from ${sql.identifier(t)}`,
      );
      expect([...rows][0]?.n, `${t} ไม่ควรคืนแถวเมื่อไม่ได้ตั้ง tenant`).toBe(0);
    }
  });
});

describe('กฎข้อ 3 · พูลขนาด 1 สลับที่ทำงานติดกัน — ข้อที่จับ LOCAL ที่หายไป', () => {
  it('A → B → A บน connection เดียวกัน ไม่มีข้อมูลปนกัน', async () => {
    const countA1 = await asTenant(tenantA, async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from tasks`);
      return [...r][0]?.n ?? -1;
    });
    const countB = await asTenant(tenantB, async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from tasks`);
      return [...r][0]?.n ?? -1;
    });
    const countA2 = await asTenant(tenantA, async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from tasks`);
      return [...r][0]?.n ?? -1;
    });

    expect(countA1).toBeGreaterThan(0);
    expect(countB).toBeGreaterThan(0);
    expect(countA1).not.toBe(countB);
    expect(countA2, 'รอบสองของ A ต้องเท่ารอบแรก ไม่ใช่ค่าของ B').toBe(countA1);
  });

  /**
   * ข้อนี้คือข้อที่จับ LOCAL ที่หายไปได้จริง — พิสูจน์ด้วยการลองเอา true ออกแล้วรัน
   * ข้อ "A → B → A" ข้างบน **ไม่จับ** เพราะทุกธุรกรรมตั้งค่าใหม่อยู่แล้ว
   * ต้องถามนอกธุรกรรมเท่านั้นถึงจะเห็นว่าค่าติดค้างกับ connection หรือเปล่า
   */
  it('ค่า app.tenant_id ไม่ติดค้างหลังจบธุรกรรม', async () => {
    await asTenant(tenantA, async (tx) => {
      await tx.execute(sql`select 1`);
    });
    // นอกธุรกรรมบน connection เดิม ต้องกลับไปเห็น 0 แถว
    const rows = await appDb.execute<{ n: number }>(sql`select count(*)::int as n from tasks`);
    expect([...rows][0]?.n, 'ค่า tenant ติดค้างกับ connection').toBe(0);
  });

  it('ขอข้อมูลของอีกที่ทำงานด้วย id ตรงๆ ต้องไม่พบ (404 ไม่ใช่ 403)', async () => {
    const idInB = await asTenant(tenantB, async (tx) => {
      const r = await tx.execute<{ id: string }>(sql`select id from projects limit 1`);
      return [...r][0]?.id ?? '';
    });
    expect(idInB).not.toBe('');

    const found = await asTenant(tenantA, async (tx) => {
      const r = await tx.execute<{ id: string }>(sql`select id from projects where id = ${idInB}`);
      return [...r].length;
    });
    expect(found, 'เห็นข้อมูลของอีกที่ทำงาน').toBe(0);
  });

  it('เขียนข้ามที่ทำงานไม่ได้ แม้ระบุ tenant_id ของอีกฝั่งตรงๆ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`
            insert into clients (tenant_id, name, code)
            values (${tenantB}, 'แอบใส่ข้ามบริษัท', 'X')
          `);
        }),
      /row-level security|policy/i,
    );
  });
});

describe('กฎข้อ 4 · คอลัมน์ขยับได้ทางเดียว', () => {
  it('UPDATE column_key ตรงๆ ถูก trigger ปฏิเสธ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`
          update tasks set column_key = 'done'
          where column_key <> 'done' and id = (select id from tasks where column_key <> 'done' limit 1)
        `);
        }),
      /เปลี่ยนได้ทาง POST/,
    );
  });

  it('ผ่านประตูที่ถูกต้อง (ตั้ง app.allow_column_move) แล้วย้ายได้', async () => {
    const moved = await appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantA}, true)`);
      await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
      const r = await tx.execute<{ id: string }>(
        sql`select id from tasks where column_key = 'todo' limit 1`,
      );
      const id = [...r][0]?.id;
      await tx.execute(sql`update tasks set column_key = 'doing' where id = ${id}`);
      const after = await tx.execute<{ column_key: string }>(
        sql`select column_key from tasks where id = ${id}`,
      );
      return [...after][0]?.column_key;
    });
    expect(moved).toBe('doing');
  });

  it('ใบอนุญาตย้ายคอลัมน์ไม่ติดค้างข้ามธุรกรรม', async () => {
    await appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantA}, true)`);
      await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
      await tx.execute(sql`select 1`);
    });
    // ธุรกรรมถัดไปบน connection เดิม ต้องถูกปฏิเสธเหมือนเดิม
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`
          update tasks set column_key = 'review'
          where id = (select id from tasks where column_key <> 'review' limit 1)
        `);
        }),
      /เปลี่ยนได้ทาง POST/,
    );
  });

  it('ย้ายไปคอลัมน์ที่ไม่มีอยู่บนบอร์ด ถูกปฏิเสธ', async () => {
    await expectDbError(
      () =>
        appDb.transaction(async (tx) => {
          await tx.execute(sql`select set_config('app.tenant_id', ${tenantA}, true)`);
          await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
          await tx.execute(sql`
          update tasks set column_key = 'ไม่มีคอลัมน์นี้'
          where id = (select id from tasks limit 1)
        `);
        }),
      /.+/,
    );
  });
});

describe('สถานะที่ลูกค้าเห็น · ต้องมีคนกดเสมอ', () => {
  it('UPDATE portal_stage ตรงๆ ถูกปฏิเสธ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`
          update tasks set portal_stage = 'resolved'
          where id = (select id from tasks where origin = 'warranty' limit 1)
        `);
        }),
      /เปลี่ยนได้ทาง POST/,
    );
  });

  it('ผ่านประตูที่ถูกต้องแล้วเปลี่ยนได้', async () => {
    const after = await appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantA}, true)`);
      await tx.execute(sql`select set_config('app.allow_portal_stage', 'on', true)`);
      const r = await tx.execute<{ id: string }>(
        sql`select id from tasks where origin = 'warranty' and portal_stage is null limit 1`,
      );
      const id = [...r][0]?.id;
      await tx.execute(sql`update tasks set portal_stage = 'received' where id = ${id}`);
      const x = await tx.execute<{ portal_stage: string }>(
        sql`select portal_stage from tasks where id = ${id}`,
      );
      return [...x][0]?.portal_stage;
    });
    expect(after).toBe('received');
  });
});

describe('กฎข้อ 5 · task_events เขียนอย่างเดียว', () => {
  it('role app ลบเหตุการณ์ไม่ได้', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(
            sql`delete from task_events where id = (select id from task_events limit 1)`,
          );
        }),
      /.+/,
    );
  });

  it('role app แก้เหตุการณ์ย้อนหลังไม่ได้', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`update task_events set reason = 'แก้ย้อนหลัง'`);
        }),
      /.+/,
    );
  });

  it('แต่เขียนเพิ่มได้ตามปกติ', async () => {
    const n = await asTenant(tenantA, async (tx) => {
      const t = await tx.execute<{ id: string }>(sql`select id from tasks limit 1`);
      const taskId = [...t][0]?.id;
      await tx.execute(sql`
        insert into task_events (tenant_id, task_id, to_column_key, to_column_name, to_column_index, column_count)
        values (${tenantA}, ${taskId}, 'doing', 'กำลังทำ', 1, 4)
      `);
      const r = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from task_events where task_id = ${taskId}`,
      );
      return [...r][0]?.n ?? 0;
    });
    expect(n).toBeGreaterThan(1);
  });
});

describe('กฎข้อ 12 · ทุกที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคน', () => {
  it('ลดบทบาทเจ้าของคนสุดท้าย ถูก trigger ปฏิเสธ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`update memberships set role = 'member' where role = 'owner'`);
        }),
      /เจ้าของ/,
    );
  });

  it('ลบเจ้าของคนสุดท้าย ถูกปฏิเสธ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`delete from memberships where role = 'owner'`);
        }),
      /เจ้าของ/,
    );
  });
});

describe('กฎข้อ 8 · บอร์ดตั้งได้ 2–8 คอลัมน์', () => {
  it('คอลัมน์เดียวถูกปฏิเสธ', async () => {
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(
            sql`update projects set board = '[{"key":"a","name":"เดียว"}]'::jsonb where key = 'ACM'`,
          );
        }),
      /projects_board_size/,
    );
  });

  it('เก้าคอลัมน์ถูกปฏิเสธ', async () => {
    const nine = JSON.stringify(
      Array.from({ length: 9 }, (_, i) => ({ key: `c${i}`, name: `คอลัมน์ ${i}` })),
    );
    await expectDbError(
      () =>
        asTenant(tenantA, async (tx) => {
          await tx.execute(sql`update projects set board = ${nine}::jsonb where key = 'ACM'`);
        }),
      /projects_board_size/,
    );
  });
});
