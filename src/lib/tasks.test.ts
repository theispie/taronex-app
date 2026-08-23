/**
 * เกณฑ์ผ่านของ M4 — PATCH /tasks/:id ที่มี column_key ต้องตอบ 400
 * และกติกาอื่นของการ์ดที่ผิดแล้วเงียบ
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { createClient, createProject } from './projects';
import {
  addComment,
  createTask,
  deleteTask,
  getTask,
  listComments,
  listTasks,
  setEta,
  taskHistory,
  updateTask,
} from './tasks';

const APP_URL = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const OWNER_URL =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let projectId = '';
let userId = '';

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

/** ธุรกรรมที่ปลดล็อก trigger เหมือน withColumnMove() ในโค้ดจริง */
const asColumnMove = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
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
    .values({ name: 'ทดสอบ M4', slug: 'm4testtenant' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';
  const u = await ownerDb
    .insert(s.users)
    .values({ email: 'pm@m4.co', name: 'พีเอ็ม', passwordHash: 'x' })
    .returning({ id: s.users.id });
  userId = u[0]?.id ?? '';

  const p = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    return createProject(tx, tenantId, {
      key: 'ACM',
      name: 'โปรเจกต์',
      clientId: c?.id ?? '',
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    });
  });
  projectId = p?.id ?? '';
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

const mkTask = (title = 'การ์ดทดสอบ') =>
  asTenant((tx) => createTask(tx, tenantId, projectId, userId, { title }));

describe('เกณฑ์ผ่าน · PATCH ที่มี column_key ต้องตอบ 400', () => {
  it('ปฏิเสธ column_key พร้อมบอกว่าต้องใช้ประตูไหน', async () => {
    const t = await mkTask();
    await expect(
      asTenant((tx) => updateTask(tx, t.id, { title: 'ชื่อใหม่', column_key: 'done' })),
    ).rejects.toThrow(/POST \/tasks\/:id\/transition/);
  });

  it('ปฏิเสธทั้งแบบ snake_case และ camelCase', async () => {
    const t = await mkTask();
    await expect(asTenant((tx) => updateTask(tx, t.id, { columnKey: 'done' }))).rejects.toThrow(
      /transition/,
    );
  });

  it('ปฏิเสธ portal_stage ด้วยเหตุผลเดียวกัน', async () => {
    const t = await mkTask();
    await expect(
      asTenant((tx) => updateTask(tx, t.id, { portal_stage: 'resolved' })),
    ).rejects.toThrow(/portal-stage/);
  });

  it('ปฏิเสธก่อนแก้ฟิลด์อื่น — ไม่ใช่แก้บางส่วนแล้วค่อยตก', async () => {
    const t = await mkTask('ชื่อเดิม');
    await expect(
      asTenant((tx) => updateTask(tx, t.id, { title: 'ชื่อใหม่', column_key: 'done' })),
    ).rejects.toThrow();
    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.title, 'ต้องไม่แก้อะไรเลยเมื่อมีฟิลด์ต้องห้าม').toBe('ชื่อเดิม');
  });

  it('แก้ฟิลด์ที่อนุญาตได้ตามปกติ', async () => {
    const t = await mkTask();
    await asTenant((tx) => updateTask(tx, t.id, { title: 'ชื่อใหม่', priority: 'critical' }));
    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.title).toBe('ชื่อใหม่');
    expect(after.priority).toBe('critical');
  });
});

describe('กฎข้อ 8 · การ์ดใหม่ลงคอลัมน์แรกเสมอ', () => {
  it('ไม่รับพารามิเตอร์คอลัมน์ · ลงคอลัมน์แรกทุกครั้ง', async () => {
    const t = await mkTask();
    const got = await asTenant((tx) => getTask(tx, t.id));
    expect(got.columnKey).toBe('todo');
    expect(got.columnIndex).toBe(0);
    expect(got.isClosed).toBe(false);
  });

  it('เขียนประวัติแถวแรกพร้อมชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้น', async () => {
    const t = await mkTask();
    const h = await asTenant((tx) => taskHistory(tx, t.id));
    expect(h).toHaveLength(1);
    expect(h[0]?.toColumnName).toBe('รอเริ่ม');
    expect(h[0]?.toColumnIndex).toBe(0);
  });

  it('เลขการ์ดเดินทีละหนึ่งและไม่ซ้ำ', async () => {
    const a = await mkTask('หนึ่ง');
    const b = await mkTask('สอง');
    const c = await mkTask('สาม');
    expect([a.code, b.code, c.code]).toEqual(['ACM-1', 'ACM-2', 'ACM-3']);
  });
});

describe('กฎข้อ 6 · คอมเมนต์ตั้งต้นเป็นภายใน', () => {
  it('ไม่ระบุ = ภายใน ลูกค้าไม่เห็น', async () => {
    const t = await mkTask();
    await asTenant((tx) => addComment(tx, tenantId, t.id, userId, { body: 'ข้อความ' }));
    const all = await asTenant((tx) => listComments(tx, t.id));
    expect(all[0]?.isInternal, 'พลาดทางนี้ปลอดภัยกว่า').toBe(true);

    const forClient = await asTenant((tx) => listComments(tx, t.id, true));
    expect(forClient, 'มุมมองลูกค้าต้องไม่เห็นคอมเมนต์ภายใน').toHaveLength(0);
  });

  it('ตั้งเป็นไม่ภายในแล้วลูกค้าเห็น', async () => {
    const t = await mkTask();
    await asTenant((tx) =>
      addComment(tx, tenantId, t.id, userId, { body: 'บอกลูกค้าได้', isInternal: false }),
    );
    const forClient = await asTenant((tx) => listComments(tx, t.id, true));
    expect(forClient).toHaveLength(1);
  });
});

describe('ลบการ์ด · ประวัติต้องไม่หาย (กฎข้อ 5)', () => {
  it('ลบการ์ดได้ แต่แถวเหตุการณ์ยังอยู่', async () => {
    const t = await mkTask();
    const before = await ownerDb.execute<{ n: number }>(
      sql`select count(*)::int as n from task_events`,
    );
    expect([...before][0]?.n).toBe(1);

    await asTenant((tx) => deleteTask(tx, t.id));

    const tasksLeft = await ownerDb.execute<{ n: number }>(
      sql`select count(*)::int as n from tasks`,
    );
    const eventsLeft = await ownerDb.execute<{ n: number; orphan: number }>(sql`
      select count(*)::int as n, count(*) filter (where task_id is null)::int as orphan
      from task_events
    `);
    expect([...tasksLeft][0]?.n, 'การ์ดต้องหายไป').toBe(0);
    expect([...eventsLeft][0]?.n, 'เหตุการณ์ต้องยังอยู่เป็นหลักฐาน').toBe(1);
    expect([...eventsLeft][0]?.orphan, 'ฐานข้อมูลตัด FK ให้เอง').toBe(1);
  });
});

describe('กรองและตัวเลขที่คำนวณสด', () => {
  it('กรองตามคอลัมน์ ผู้รับผิดชอบ และงานนอกแผน', async () => {
    await mkTask('หนึ่ง');
    const b = await mkTask('สอง');
    await asTenant((tx) => updateTask(tx, b.id, { assigneeId: userId }));

    const all = await asTenant((tx) => listTasks(tx, projectId));
    expect(all).toHaveLength(2);

    const mine = await asTenant((tx) => listTasks(tx, projectId, { assigneeId: userId }));
    expect(mine).toHaveLength(1);

    const unplanned = await asTenant((tx) => listTasks(tx, projectId, { unplanned: true }));
    expect(unplanned, 'ยังไม่มีงานหลัก ทุกใบจึงเป็นงานนอกแผน').toHaveLength(2);

    const inDone = await asTenant((tx) => listTasks(tx, projectId, { columnKey: 'done' }));
    expect(inDone).toHaveLength(0);
  });

  it('ปิดงานอ่านจากตำแหน่งคอลัมน์ ไม่ได้เก็บไว้', async () => {
    const t = await mkTask();
    await asColumnMove(async (tx) => {
      await tx.execute(sql`update tasks set column_key = 'done' where id = ${t.id}`);
    });
    const got = await asTenant((tx) => getTask(tx, t.id));
    expect(got.isClosed).toBe(true);
    expect(got.columnIndex).toBe(3);
  });

  it('ถือมากี่วัน คำนวณสดจาก task_events', async () => {
    await mkTask();
    const list = await asTenant((tx) => listTasks(tx, projectId));
    expect(list[0]?.heldDays).toBe(0);
  });
});

describe('คำตอบ "จะเสร็จเมื่อไร"', () => {
  it('เก็บเวลาที่ตอบไว้ด้วย เพราะคำตอบเก่ากว่า 3 วันถือว่าหมดอายุ', async () => {
    const t = await mkTask();
    await asTenant((tx) => setEta(tx, t.id, 'tomorrow'));
    const got = await asTenant((tx) => getTask(tx, t.id));
    expect(got.eta).toBe('tomorrow');
    expect(got.etaUpdatedAt).not.toBeNull();
  });
});
