/**
 * เกณฑ์ผ่านของ M3 ตาม BUILD-PLAN
 *   ลบงานหลักแล้วการ์ดยังอยู่ และ feature_id เป็น NULL
 *   สร้าง key ซ้ำได้ 409
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import {
  addContact,
  addFeature,
  addPhase,
  createClient,
  createProject,
  deleteFeature,
  enterPhase,
  listClients,
  listFeatures,
  listProjects,
  lockBaseline,
  projectHealth,
  removeContact,
  updateProject,
} from './projects';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let clientId = '';

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

beforeEach(async () => {
  await ownerDb.execute(sql`
    TRUNCATE sla_clock_events, sla_clocks, sla_policy_levels, sla_policies,
             warranty_contracts, time_entries, attachments, comments, task_events, tasks,
             project_members, features, project_phases, projects, project_templates,
             portal_tokens, client_contacts, clients, invitations, memberships,
             sessions, notifications, users, tenants
    RESTART IDENTITY CASCADE
  `);
  const t = await ownerDb
    .insert(s.tenants)
    .values({ name: 'ทดสอบ M3', slug: 'm3testtenant' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';
  const c = await asTenant((tx) => createClient(tx, tenantId, { name: 'ลูกค้าทดสอบ', code: 'TST' }));
  clientId = c?.id ?? '';
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

const mkProject = (key: string) =>
  asTenant((tx) =>
    createProject(tx, tenantId, {
      key,
      name: `โปรเจกต์ ${key}`,
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    }),
  );

describe('เกณฑ์ 1 · ลบงานหลักแล้วการ์ดต้องไม่หาย', () => {
  it('การ์ดยังอยู่ครบ และ feature_id กลายเป็น NULL', async () => {
    const p = await mkProject('ACM');
    const f = await asTenant((tx) => addFeature(tx, tenantId, p?.id ?? '', { name: 'ตะกร้าสินค้า' }));

    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values([
        {
          tenantId,
          projectId: p?.id ?? '',
          featureId: f?.id,
          number: 1,
          title: 'การ์ดหนึ่ง',
          columnKey: 'todo',
        },
        {
          tenantId,
          projectId: p?.id ?? '',
          featureId: f?.id,
          number: 2,
          title: 'การ์ดสอง',
          columnKey: 'doing',
        },
      ]);
    });

    const result = await asTenant((tx) => deleteFeature(tx, f?.id ?? ''));
    expect(result.tasksBecameUnplanned).toBe(2);

    const after = await asTenant(async (tx) => {
      const r = await tx.execute<{ n: number; orphan: number }>(sql`
        select count(*)::int as n,
               count(*) filter (where feature_id is null)::int as orphan
        from tasks where project_id = ${p?.id}
      `);
      return [...r][0];
    });
    expect(after?.n, 'การ์ดต้องยังอยู่ครบ').toBe(2);
    expect(after?.orphan, 'ทุกใบต้องกลายเป็นงานนอกแผน').toBe(2);

    const left = await asTenant((tx) => listFeatures(tx, p?.id ?? ''));
    expect(left).toHaveLength(0);
  });

  it('การ์ดที่กลายเป็นงานนอกแผนถูกนับในตัวเลขสุขภาพ', async () => {
    const p = await mkProject('ACM');
    const f = await asTenant((tx) => addFeature(tx, tenantId, p?.id ?? '', { name: 'งานหลัก' }));
    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values({
        tenantId,
        projectId: p?.id ?? '',
        featureId: f?.id,
        number: 1,
        title: 'x',
        columnKey: 'todo',
      });
    });
    await asTenant((tx) => deleteFeature(tx, f?.id ?? ''));
    const h = await asTenant((tx) => projectHealth(tx, p?.id ?? ''));
    expect(h.unplannedTasks).toBe(1);
  });
});

describe('เกณฑ์ 2 · รหัสโปรเจกต์ซ้ำต้องได้ 409', () => {
  it('สร้างรหัสเดิมซ้ำถูกปฏิเสธด้วย E_KEY_TAKEN', async () => {
    await mkProject('ACM');
    await expect(mkProject('ACM')).rejects.toThrow(/ถูกใช้ไปแล้ว/);
  });

  it('รหัสไม่สนตัวพิมพ์ — acm ชนกับ ACM', async () => {
    await mkProject('ACM');
    await expect(mkProject('acm')).rejects.toThrow(/ถูกใช้ไปแล้ว/);
  });

  it('รหัสที่ทำงานอื่นใช้ซ้ำได้ เพราะ UNIQUE ผูกกับที่ทำงาน', async () => {
    await mkProject('ACM');
    const other = await ownerDb
      .insert(s.tenants)
      .values({ name: 'อีกที่', slug: 'othertenant1' })
      .returning({ id: s.tenants.id });
    const otherId = other[0]?.id ?? '';

    const created = await appDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${otherId}, true)`);
      const c = await createClient(tx as unknown as Tx, otherId, { name: 'ลูกค้า', code: 'X' });
      return createProject(tx as unknown as Tx, otherId, {
        key: 'ACM',
        name: 'ชื่อซ้ำได้',
        clientId: c?.id ?? '',
        startsOn: '2026-01-01',
        dueOn: '2026-02-01',
      });
    });
    expect(created?.key).toBe('ACM');
  });

  it('รหัสผิดรูปแบบถูกปฏิเสธ', async () => {
    await expect(mkProject('A')).rejects.toThrow(/2–5 ตัว/);
    await expect(mkProject('TOOLONGKEY')).rejects.toThrow(/2–5 ตัว/);
    // ขึ้นต้นด้วยตัวเลขไม่ได้ เพราะรหัสการ์ด 2AB-138 อ่านยาก
    await expect(mkProject('2AB')).rejects.toThrow(/2–5 ตัว/);
  });

  it('รหัสที่มีตัวเลขใช้ได้ — E2E หรือ B2B ใช้กันจริง', async () => {
    const p = await mkProject('E2E');
    expect(p?.key).toBe('E2E');
  });

  it('รหัสโปรเจกต์เปลี่ยนไม่ได้หลังสร้าง', async () => {
    const p = await mkProject('ACM');
    await expect(asTenant((tx) => updateProject(tx, p?.id ?? '', { key: 'NEW' }))).rejects.toThrow(
      /เปลี่ยนไม่ได้/,
    );
  });
});

describe('กฎข้อ 8 · คอลัมน์บนบอร์ด', () => {
  it('สร้างโปรเจกต์ด้วยคอลัมน์เดียวไม่ได้', async () => {
    await expect(
      asTenant((tx) =>
        createProject(tx, tenantId, {
          key: 'ONE',
          name: 'x',
          clientId,
          startsOn: '2026-01-01',
          dueOn: '2026-02-01',
          board: [{ key: 'a', name: 'เดียว' }],
        }),
      ),
    ).rejects.toThrow(/อย่างน้อย 2 คอลัมน์/);
  });

  it('ลบคอลัมน์ที่ยังมีการ์ดอยู่ไม่ได้', async () => {
    const p = await mkProject('ACM');
    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values({
        tenantId,
        projectId: p?.id ?? '',
        number: 1,
        title: 'x',
        columnKey: 'review',
      });
    });
    await expect(
      asTenant((tx) =>
        updateProject(tx, p?.id ?? '', {
          board: [
            { key: 'todo', name: 'รอเริ่ม' },
            { key: 'doing', name: 'กำลังทำ' },
            { key: 'done', name: 'เสร็จ' },
          ],
        }),
      ),
    ).rejects.toThrow(/ยังมีการ์ดอยู่ในคอลัมน์ review/);
  });
});

describe('เฟส — สวิตช์ที่เปิดพอร์ทัล', () => {
  it('เข้าเฟส warranty แล้วพอร์ทัลเปิดเอง · เฟสอื่นปิด', async () => {
    const p = await mkProject('WEB');
    const dev = await asTenant((tx) => addPhase(tx, tenantId, p?.id ?? '', { name: 'พัฒนา' }));
    const war = await asTenant((tx) =>
      addPhase(tx, tenantId, p?.id ?? '', { name: 'ประกัน', kind: 'warranty' }),
    );

    const a = await asTenant((tx) => enterPhase(tx, p?.id ?? '', dev?.id ?? ''));
    expect(a.portalEnabled).toBe(false);

    const b = await asTenant((tx) => enterPhase(tx, p?.id ?? '', war?.id ?? ''));
    expect(b.portalEnabled, 'เฟสประกันต้องเปิดพอร์ทัลให้เอง').toBe(true);

    const list = await asTenant((tx) => listProjects(tx, {}));
    expect(list[0]?.portalEnabled).toBe(true);
    expect(list[0]?.phase?.name).toBe('ประกัน');
  });

  it('เข้าเฟสของโปรเจกต์อื่นไม่ได้', async () => {
    const p1 = await mkProject('AAA');
    const p2 = await mkProject('BBB');
    const ph = await asTenant((tx) => addPhase(tx, tenantId, p2?.id ?? '', { name: 'ของ BBB' }));
    await expect(asTenant((tx) => enterPhase(tx, p1?.id ?? '', ph?.id ?? ''))).rejects.toThrow();
  });
});

describe('ลูกค้าและผู้ติดต่อ', () => {
  it('ถอดผู้ติดต่อแล้วเรื่องที่เขาเคยแจ้งยังอยู่', async () => {
    const p = await mkProject('WEB');
    const ct = await asTenant((tx) =>
      addContact(tx, tenantId, clientId, { name: 'สมชาย', email: 'somchai@x.co' }),
    );
    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values({
        tenantId,
        projectId: p?.id ?? '',
        number: 1,
        title: 'ลูกค้าแจ้ง',
        columnKey: 'todo',
        origin: 'warranty',
        contactId: ct?.id,
      });
    });

    await asTenant((tx) => removeContact(tx, ct?.id ?? ''));

    const left = await asTenant(async (tx) => {
      const r = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from tasks where project_id = ${p?.id}`,
      );
      return [...r][0]?.n;
    });
    expect(left, 'เรื่องที่ลูกค้าแจ้งต้องไม่หายไปพร้อมผู้ติดต่อ').toBe(1);
  });

  it('อีเมลผู้ติดต่อซ้ำในลูกค้ารายเดียวกันไม่ได้', async () => {
    await asTenant((tx) => addContact(tx, tenantId, clientId, { name: 'ก', email: 'a@x.co' }));
    await expect(
      asTenant((tx) => addContact(tx, tenantId, clientId, { name: 'ข', email: 'A@X.CO' })),
    ).rejects.toThrow(/เป็นผู้ติดต่ออยู่แล้ว/);
  });

  it('รายชื่อลูกค้าแสดงจำนวนโปรเจกต์และผู้ติดต่อ', async () => {
    await mkProject('ACM');
    await asTenant((tx) => addContact(tx, tenantId, clientId, { name: 'ก', email: 'a@x.co' }));
    const list = await asTenant((tx) => listClients(tx));
    expect(list[0]?.projects).toBe(1);
    expect(list[0]?.contacts).toBe(1);
  });
});

describe('ตัวเลขตั้งต้นและสุขภาพ', () => {
  it('lock baseline นับเฉพาะงานส่งมอบ ไม่นับงานประกัน', async () => {
    const p = await mkProject('ACM');
    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values([
        { tenantId, projectId: p?.id ?? '', number: 1, title: 'ส่งมอบ', columnKey: 'todo' },
        { tenantId, projectId: p?.id ?? '', number: 2, title: 'ส่งมอบ', columnKey: 'todo' },
        {
          tenantId,
          projectId: p?.id ?? '',
          number: 3,
          title: 'ประกัน',
          columnKey: 'todo',
          origin: 'warranty',
        },
      ]);
    });
    const r = await asTenant((tx) => lockBaseline(tx, p?.id ?? ''));
    expect(r.baselineTaskCount).toBe(2);

    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values({
        tenantId,
        projectId: p?.id ?? '',
        number: 4,
        title: 'งานเพิ่ม',
        columnKey: 'todo',
      });
    });
    const h = await asTenant((tx) => projectHealth(tx, p?.id ?? ''));
    expect(h.addedAfterBaseline, 'การ์ดที่เพิ่มหลังบันทึกตัวเลขตั้งต้น').toBe(1);
    expect(h.warrantyTasks).toBe(1);
  });
});
