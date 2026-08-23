/**
 * เกณฑ์ผ่านของ M8
 *   ค้นด้วยคำไทยที่ไม่มีเว้นวรรคยังเจอ
 *   โหมดย้อนหลังคืนเจ้าของ ณ เวลานั้นได้ถูกต้อง
 *
 * และกฎข้อ 9 — ไม่มีตัวเลขที่เอามาเรียงลำดับคนได้
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { createClient, createProject } from './projects';
import { createTask } from './tasks';
import { transition } from './transition';
import { calendar, home, myTasks, search, teamNow, teamRange } from './views';

const APP_URL = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const OWNER_URL =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let projectId = '';
let pm = '';
let dev = '';
let qa = '';

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

const move = <T>(fn: (tx: Tx) => Promise<T>) =>
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
    .values({ name: 'ทดสอบ M8', slug: 'm8testtenant' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values([
      { email: 'pm@m8.co', name: 'พีเอ็ม', passwordHash: 'x' },
      { email: 'dev@m8.co', name: 'เดฟ', passwordHash: 'x' },
      { email: 'qa@m8.co', name: 'คิวเอ', passwordHash: 'x' },
    ])
    .returning({ id: s.users.id });
  pm = us[0]?.id ?? '';
  dev = us[1]?.id ?? '';
  qa = us[2]?.id ?? '';

  await ownerDb.insert(s.memberships).values([
    { tenantId, userId: pm, role: 'owner', jobTitle: 'pm' },
    { tenantId, userId: dev, role: 'member', jobTitle: 'dev' },
    { tenantId, userId: qa, role: 'member', jobTitle: 'qa' },
  ]);

  const p = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    return createProject(tx, tenantId, {
      key: 'ACM',
      name: 'ระบบสั่งซื้อออนไลน์',
      clientId: c?.id ?? '',
      pmUserId: pm,
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

const mk = (title: string, extra: Record<string, unknown> = {}) =>
  asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title, ...extra }));

describe('เกณฑ์ 1 · ค้นคำไทยที่ไม่มีเว้นวรรค', () => {
  it('ค้นคำที่อยู่กลางประโยคยาวที่ไม่มีเว้นวรรคเลย', async () => {
    await mk('รอหัวหน้าอนุมัติก่อนส่งให้ลูกค้า');
    const r = await asTenant((tx) => search(tx, 'อนุมัติ'));
    expect(r.tasks, 'ตัวตัดคำของ Postgres มองทั้งประโยคเป็นคำเดียว จึงต้องใช้ ILIKE').toHaveLength(1);
    expect(r.tasks[0]?.title).toContain('อนุมัติ');
  });

  it('ค้นคำที่อยู่ท้ายประโยคก็เจอ', async () => {
    await mk('แก้บั๊กตะกร้าสินค้าคำนวณส่วนลดผิด');
    const r = await asTenant((tx) => search(tx, 'ส่วนลด'));
    expect(r.tasks).toHaveLength(1);
  });

  it('ค้นด้วยรหัสการ์ดเจอตรงๆ — คนอ้างรหัสกันในไลน์', async () => {
    const a = await mk('การ์ดหนึ่ง');
    const r = await asTenant((tx) => search(tx, a.code));
    expect(r.matchedByCode).toBe(true);
    expect(r.tasks[0]?.code).toBe(a.code);
  });

  it('ค้นด้วยชื่อโปรเจกต์ก็เจอการ์ดในโปรเจกต์นั้น', async () => {
    await mk('งานอะไรก็ได้');
    const r = await asTenant((tx) => search(tx, 'สั่งซื้อ'));
    expect(r.tasks.length).toBeGreaterThan(0);
  });

  it('อักขระพิเศษของ SQL ไม่ทำให้ค้นเพี้ยนหรือหลุด', async () => {
    await mk('ราคา 100% ของยอด');
    await mk('ชื่อธรรมดา');
    // % เป็นไวลด์การ์ดของ LIKE — ถ้าไม่ escape จะคืนทุกใบ
    const r = await asTenant((tx) => search(tx, '100%'));
    expect(r.tasks).toHaveLength(1);

    const quote = await asTenant((tx) => search(tx, "o'brien"));
    expect(quote.tasks).toHaveLength(0);
  });
});

describe('เกณฑ์ 2 · โหมดย้อนหลังคืนเจ้าของ ณ เวลานั้น', () => {
  it('อ่านจาก task_events ไม่ใช่จาก tasks.assignee_id ที่เป็นค่าปัจจุบัน', async () => {
    const t = await mk('การ์ดที่เปลี่ยนมือ');

    // วันแรก เดฟรับงาน
    await move((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: 'doing', assigneeId: dev }),
    );
    // ย้อนเวลาให้ทั้งการ์ดและเหตุการณ์ เพื่อจำลองว่าการ์ดนี้มีอยู่ตั้งแต่สองวันก่อน
    // ถ้าย้อนแค่เหตุการณ์ ข้อมูลจะขัดกันเอง — การ์ดที่ยังไม่ถูกสร้างจะมีประวัติได้ยังไง
    await ownerDb.execute(sql`
      update tasks set created_at = now() - interval '3 days' where id = ${t.id}
    `);
    // แยกเวลาของแต่ละเหตุการณ์ให้ต่างกัน ไม่งั้นสองแถวได้เวลาเท่ากันเป๊ะ
    // แล้ว "เหตุการณ์ล่าสุด" จะไม่แน่นอนว่าเป็นแถวไหน
    await ownerDb.execute(sql`
      update task_events set at = now() - interval '3 days'
      where task_id = ${t.id} and from_column_key is null
    `);
    await ownerDb.execute(sql`
      update task_events set at = now() - interval '2 days'
      where task_id = ${t.id} and to_user_id = ${dev}
    `);

    // วันนี้ ส่งต่อให้คิวเอ
    await move((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: 'review', assigneeId: qa }),
    );

    const now = await asTenant((tx) => teamNow(tx));
    expect(now.find((p) => p.userId === qa)?.holding, 'ตอนนี้คิวเอถืออยู่').toBe(1);
    expect(now.find((p) => p.userId === dev)?.holding, 'เดฟไม่ได้ถือแล้ว').toBe(0);

    // ย้อนไปเมื่อวาน — ตอนนั้นเดฟเป็นคนถือ
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const range = await asTenant((tx) => teamRange(tx, yesterday, yesterday));
    const devRow = range.find((r) => r.userId === dev);
    expect(devRow, 'เมื่อวานเดฟต้องปรากฏในรายการ').toBeDefined();
    expect(devRow?.perDay[0]?.holding).toBe(1);
    expect(
      range.find((r) => r.userId === qa),
      'เมื่อวานคิวเอยังไม่ได้ถือ',
    ).toBeUndefined();
  });
});

describe('กฎข้อ 9 · ไม่มีตัวเลขที่เอามาเรียงลำดับคนได้', () => {
  it('ภาพรวมทีมคืนแค่ภาระตอนนี้ ไม่มีผลงานสะสม', async () => {
    const t = await mk('งาน');
    await move((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: 'doing', assigneeId: dev }),
    );
    const rows = await asTenant((tx) => teamNow(tx));
    const keys = Object.keys(rows[0] ?? {});
    // ถ้าวันหนึ่งมีใครเติมฟิลด์พวกนี้เข้ามา เทสต์นี้จะแดงทันที
    for (const banned of ['completed', 'closedCount', 'velocity', 'score', 'throughput']) {
      expect(keys, `ห้ามมีฟิลด์ ${banned} — เป็นตัวเลขที่เอามาเรียงลำดับคนได้`).not.toContain(banned);
    }
    expect(keys).toContain('holding');
    expect(keys).toContain('flags');
  });

  it('การ์ดที่ปิดแล้วไม่นับใน "ถืออยู่"', async () => {
    const t = await mk('งานที่จะปิด');
    await move((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: 'doing', assigneeId: dev }),
    );
    let rows = await asTenant((tx) => teamNow(tx));
    expect(rows.find((r) => r.userId === dev)?.holding).toBe(1);

    await move((tx) => transition(tx, t.id, { userId: pm, isPm: true }, { toColumnKey: 'done' }));
    rows = await asTenant((tx) => teamNow(tx));
    expect(rows.find((r) => r.userId === dev)?.holding, 'ปิดแล้วไม่นับใน "ถืออยู่"').toBe(0);
  });

  it('ป้ายบอกอาการ ไม่ใช่คะแนน', async () => {
    const rows = await asTenant((tx) => teamNow(tx));
    const idle = rows.find((r) => r.holding === 0);
    expect(idle?.flags).toContain('ยังไม่มีการ์ดที่ถืออยู่');
  });
});

describe('งานที่ได้รับ · หน้าแรก · ปฏิทิน', () => {
  it('จัดกลุ่มจากอาการ ไม่ใช่จากความเร่งด่วนที่ตั้งไว้', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const late = await mk('เลยกำหนด', { assigneeId: dev, dueDate: yesterday, priority: 'low' });
    await mk('ครบวันนี้', { assigneeId: dev, dueDate: today });
    await mk('ด่วนมากแต่ยังไม่ถึงกำหนด', { assigneeId: dev, priority: 'critical' });

    const r = await asTenant((tx) => myTasks(tx, dev));
    expect(r.late.map((c) => c.id)).toEqual([late.id]);
    expect(r.dueToday).toHaveLength(1);
    // การ์ด critical ที่ยังไม่ถึงกำหนด ไม่ได้เร่งกว่าการ์ดที่เลยกำหนดแล้ว
    expect(r.rest).toHaveLength(1);
    expect(r.needEta, 'ยังไม่มีใบไหนตอบว่าจะเสร็จเมื่อไร').toHaveLength(3);
  });

  it('หน้าแรกของ PM แสดงการ์ดที่รอตัดสิน', async () => {
    const t = await mk('รอตรวจ');
    await move((tx) =>
      transition(
        tx,
        t.id,
        { userId: dev, isPm: false },
        { toColumnKey: 'review', assigneeId: dev },
      ),
    );
    const h = await asTenant((tx) => home(tx, pm));
    expect(
      h.waitingOnYou.map((c) => c.id),
      'คอลัมน์รองสุดท้าย = รอ PM ตัดสิน',
    ).toEqual([t.id]);
    expect(h.projects).toHaveLength(1);
  });

  it('ปฏิทินจัดกลุ่มตามวันกำหนดส่ง', async () => {
    await mk('ก', { dueDate: '2026-03-10' });
    await mk('ข', { dueDate: '2026-03-10' });
    await mk('ค', { dueDate: '2026-03-11' });
    const days = await asTenant((tx) => calendar(tx, '2026-03-01', '2026-03-31'));
    expect(days).toHaveLength(2);
    expect(days[0]?.tasks).toHaveLength(2);
  });
});
