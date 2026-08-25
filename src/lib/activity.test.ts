/**
 * เกณฑ์ผ่านของ M11ข — หน้ากิจกรรม
 *
 * เกณฑ์ที่สำคัญที่สุดคือกฎข้อ 9 · เทสต์ชุด "ห้ามมีตัวเลข" อยู่ล่างสุด
 * ถ้าวันหนึ่งมีใครเผลอคืนจำนวนดิบออกไป เทสต์นั้นจะพังทันที
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import { activity } from './activity';
import { createClient, createProject } from './projects';
import { addComment, createTask } from './tasks';
import { transition } from './transition';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let projectId = '';
let otherProjectId = '';
let pm = '';
let dev = '';
let board: { key: string; name: string }[] = [];

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

const asColumnMove = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
    return fn(tx as unknown as Tx);
  });

/** ย้อนเวลาเหตุการณ์ล่าสุดของการ์ดใบหนึ่ง — สร้างประวัติจำลอง */
async function backdateLatest(taskId: string, at: string) {
  await ownerDb.execute(sql`
    update task_events set at = ${at}
     where id = (select id from task_events where task_id = ${taskId} order by at desc limit 1)
  `);
}

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
    .values({ name: 'ทดสอบกิจกรรม', slug: 'm11btesttena' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values([
      { email: 'pm@act.co', name: 'พีเอ็ม', passwordHash: 'x' },
      { email: 'dev@act.co', name: 'เดฟ', passwordHash: 'x' },
    ])
    .returning({ id: s.users.id });
  pm = us[0]?.id ?? '';
  dev = us[1]?.id ?? '';

  await ownerDb.insert(s.memberships).values([
    { tenantId, userId: pm, role: 'owner' },
    { tenantId, userId: dev, role: 'member' },
  ]);

  const made = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    const p = await createProject(tx, tenantId, {
      key: 'ACM',
      name: 'โปรเจกต์หนึ่ง',
      clientId: c?.id ?? '',
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
    });
    const q = await createProject(tx, tenantId, {
      key: 'BTA',
      name: 'โปรเจกต์สอง',
      clientId: c?.id ?? '',
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
    });
    return { p: p?.id ?? '', q: q?.id ?? '' };
  });
  projectId = made.p;
  otherProjectId = made.q;

  const b = await asTenant((tx) =>
    tx.select({ board: s.projects.board }).from(s.projects).where(sql`id = ${projectId}`),
  );
  board = (b[0]?.board as { key: string; name: string }[]) ?? [];
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

const ids = () => [projectId, otherProjectId];

describe('รายวัน · เส้นเวลาล้วน', () => {
  it('เห็นเหตุการณ์จริงพร้อมคนทำ', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ดหนึ่ง' }));
    await asColumnMove((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: board[1]?.key ?? '' }),
    );
    await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: 'ทำถึงไหนแล้ว' }));

    const r = await asTenant((tx) =>
      activity(tx, { range: 'day', group: 'person', projectIds: ids() }),
    );
    expect(r.events.length).toBe(3);
    expect(r.events[0]?.text).toBe(`สร้าง ${t.code}`);
    expect(r.events.some((e) => e.text.includes('ย้าย'))).toBe(true);
    expect(r.events.some((e) => e.text.includes('บันทึกความคืบหน้า'))).toBe(true);
    expect(r.events.map((e) => e.actorName)).toContain('เดฟ');
  });

  it('เหตุการณ์ของวันอื่นไม่ปน', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ดเก่า' }));
    await backdateLatest(t.id, '2026-01-05T04:00:00Z');

    const today = await asTenant((tx) =>
      activity(tx, { range: 'day', group: 'person', projectIds: ids() }),
    );
    expect(today.events).toHaveLength(0);

    const then = await asTenant((tx) =>
      activity(tx, { range: 'day', group: 'person', date: '2026-01-05', projectIds: ids() }),
    );
    expect(then.events).toHaveLength(1);
  });

  it('โปรเจกต์ที่มองไม่เห็นไม่โผล่', async () => {
    await asTenant((tx) => createTask(tx, tenantId, otherProjectId, pm, { title: 'ของอีกโปรเจกต์' }));
    const r = await asTenant((tx) =>
      activity(tx, { range: 'day', group: 'person', projectIds: [projectId] }),
    );
    expect(r.events).toHaveLength(0);
  });

  it('ไม่มีโปรเจกต์ที่เห็นเลย คืนชุดว่าง ไม่ใช่พัง', async () => {
    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: [] }),
    );
    expect(r.rows).toHaveLength(0);
    expect(r.overall).toHaveLength(7);
  });
});

describe('รายสัปดาห์และรายเดือน', () => {
  it('สัปดาห์มี 7 ช่อง เริ่มวันจันทร์', async () => {
    // 2026-08-19 คือวันพุธ · สัปดาห์นั้นเริ่มจันทร์ 17
    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', date: '2026-08-19', projectIds: ids() }),
    );
    expect(r.from).toBe('2026-08-17');
    expect(r.to).toBe('2026-08-23');
    expect(r.labels[0]).toBe('จันทร์');
    expect(r.overall).toHaveLength(7);
  });

  it('เดือนมีช่องเท่าจำนวนวันจริง', async () => {
    const feb = await asTenant((tx) =>
      activity(tx, { range: 'month', group: 'person', date: '2026-02-10', projectIds: ids() }),
    );
    expect(feb.overall).toHaveLength(28);
    const aug = await asTenant((tx) =>
      activity(tx, { range: 'month', group: 'person', date: '2026-08-10', projectIds: ids() }),
    );
    expect(aug.overall).toHaveLength(31);
  });

  it('จัดกลุ่มตามคน และตามโปรเจกต์ ได้คนละชุด', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'ก' }));
    await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: 'x' }));

    const byPerson = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    expect([...byPerson.rows.map((r) => r.name)].sort()).toEqual(['พีเอ็ม', 'เดฟ'].sort());

    const byProject = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'project', projectIds: ids() }),
    );
    // ตามโปรเจกต์ไม่เติมแถวว่าง — โปรเจกต์ที่ไม่มีความเคลื่อนไหวไม่ใช่คนที่ต้องระวังคำพูด
    expect(byProject.rows.map((r) => r.name)).toEqual(['โปรเจกต์หนึ่ง']);
  });

  it('คนที่ไม่มีความเคลื่อนไหวยังมีแถว และบอกว่าถือการ์ดอะไรอยู่', async () => {
    const t = await asTenant((tx) =>
      createTask(tx, tenantId, projectId, pm, { title: 'ก', assigneeId: dev }),
    );
    // ย้อนเวลาให้พ้นสัปดาห์นี้ — เดฟจึงถือการ์ดอยู่แต่ไม่มีความเคลื่อนไหว
    await backdateLatest(t.id, '2026-01-05T04:00:00Z');

    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    const devRow = r.rows.find((x) => x.name === 'เดฟ');
    expect(devRow, 'ต้องมีแถว ไม่ใช่หายไปเฉยๆ').toBeDefined();
    expect(devRow?.cells.every((c) => c === 0)).toBe(true);
    expect(devRow?.holding, 'บอกว่าถือการ์ดอะไรอยู่ ไม่ใช่บอกว่าถือกี่ใบ').toEqual([t.code]);
  });

  it('เรียงตามชื่อ ไม่ใช่ตามปริมาณ', async () => {
    // ตามพจนานุกรมไทย "เดฟ" เรียงก่อน "พีเอ็ม" (ด มาก่อน พ · สระเลื่อนไปหลังพยัญชนะ)
    // ให้พีเอ็มทำเยอะกว่ามาก — ถ้าเผลอเรียงตามปริมาณเมื่อไหร่ พีเอ็มจะโผล่ขึ้นก่อน
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'ก' }));
    for (let i = 0; i < 8; i++) {
      await asTenant((tx) => addComment(tx, tenantId, t.id, pm, { body: `ครั้งที่ ${i}` }));
    }
    await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: 'ครั้งเดียว' }));

    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    expect(r.rows.map((x) => x.name)).toEqual(['เดฟ', 'พีเอ็ม']);
  });
});

describe('⭐ กฎข้อ 9 · ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้', () => {
  it('จำนวนดิบไม่ออกจากเซิร์ฟเวอร์ — คืนเฉพาะระดับ 0–3', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'ก' }));
    for (let i = 0; i < 20; i++) {
      await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: `ครั้งที่ ${i}` }));
    }
    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );

    const devRow = r.rows.find((x) => x.name === 'เดฟ');
    expect(devRow).toBeDefined();
    // 20 ครั้งกับ 8 ครั้งต้องได้ค่าเดียวกัน — เพดานอยู่ที่ 3
    expect(Math.max(...(devRow?.cells ?? []))).toBe(3);
    for (const cell of devRow?.cells ?? []) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThanOrEqual(3);
    }
    // ไม่มีตัวเลขอื่นนอกจาก 0–3 อยู่ในช่องความเข้มเลย
    // (เทียบเฉพาะ cells ไม่ใช่ทั้งก้อน เพราะ uuid มีตัวเลขปนอยู่ตามธรรมชาติ)
    const everyCell = r.rows.flatMap((x) => x.cells);
    expect(new Set(everyCell).size).toBeLessThanOrEqual(4);
    expect(everyCell.every((c) => Number.isInteger(c) && c >= 0 && c <= 3)).toBe(true);
  });

  it('คนที่ทำ 7 ครั้งกับคนที่ทำ 70 ครั้ง ได้ระดับเท่ากัน', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'ก' }));
    for (let i = 0; i < 7; i++) {
      await asTenant((tx) => addComment(tx, tenantId, t.id, pm, { body: `พีเอ็ม ${i}` }));
    }
    for (let i = 0; i < 70; i++) {
      await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: `เดฟ ${i}` }));
    }
    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    const a = Math.max(...(r.rows.find((x) => x.name === 'พีเอ็ม')?.cells ?? []));
    const b = Math.max(...(r.rows.find((x) => x.name === 'เดฟ')?.cells ?? []));
    expect(a, 'ต่างกันสิบเท่าแต่ต้องเห็นเท่ากัน — ไม่งั้นเอาไปทำ KPI ได้').toBe(b);
  });

  it('ระดับไม่ขยับตามคนอื่น — ขอบเขตเป็นค่าคงที่ ไม่ใช่เทียบกับค่าสูงสุดของกลุ่ม', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'ก' }));
    await asTenant((tx) => addComment(tx, tenantId, t.id, pm, { body: 'หนึ่ง' }));

    const before = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    const pmBefore = Math.max(...(before.rows.find((x) => x.name === 'พีเอ็ม')?.cells ?? []));

    // เดฟทำงานหนักขึ้นมาก — ระดับของพีเอ็มต้องไม่เปลี่ยน
    for (let i = 0; i < 50; i++) {
      await asTenant((tx) => addComment(tx, tenantId, t.id, dev, { body: `เดฟ ${i}` }));
    }
    const after = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    const pmAfter = Math.max(...(after.rows.find((x) => x.name === 'พีเอ็ม')?.cells ?? []));
    expect(pmAfter).toBe(pmBefore);
  });

  it('คำตอบไม่มีฟิลด์ที่ชื่อส่อว่าเป็นการนับ', async () => {
    const r = await asTenant((tx) =>
      activity(tx, { range: 'week', group: 'person', projectIds: ids() }),
    );
    const keys = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) for (const x of v) walk(x);
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
      }
    };
    walk(r);
    for (const banned of ['count', 'total', 'score', 'rank', 'events_count']) {
      expect([...keys].some((k) => k.toLowerCase().includes(banned))).toBe(false);
    }
  });
});
