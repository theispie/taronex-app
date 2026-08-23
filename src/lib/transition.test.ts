/**
 * เกณฑ์ผ่านของ M5 — เทสต์ตามทิศทาง ไม่ใช่ตามชื่อสถานะ
 *
 * BUILD-PLAN เดิมเขียนเทสต์เป็น todo→doing→review→done
 * แต่พอไม่มี task_status แล้ว เทสต์ต้องพิสูจน์กติกาที่คำนวณจากตำแหน่งแทน
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { createClient, createProject } from './projects';
import { createTask, getTask, listComments, taskHistory } from './tasks';
import { transition } from './transition';

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

/** เลียนแบบ withColumnMove() ในโค้ดจริง */
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
    .values({ name: 'ทดสอบ M5', slug: 'm5testtenant' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values([
      { email: 'pm@m5.co', name: 'พีเอ็ม', passwordHash: 'x' },
      { email: 'dev@m5.co', name: 'เดฟ', passwordHash: 'x' },
      { email: 'qa@m5.co', name: 'คิวเอ', passwordHash: 'x' },
    ])
    .returning({ id: s.users.id });
  pm = us[0]?.id ?? '';
  dev = us[1]?.id ?? '';
  qa = us[2]?.id ?? '';

  const p = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    return createProject(tx, tenantId, {
      key: 'ACM',
      name: 'โปรเจกต์',
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

const mkTask = () => asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
const go = (id: string, to: string, actor: { userId: string; isPm: boolean }, extra = {}) =>
  move((tx) => transition(tx, id, actor, { toColumnKey: to, ...extra }));

describe('เกณฑ์ 1 · เข้าคอลัมน์สุดท้าย PM เท่านั้น', () => {
  it('คนที่ไม่ใช่ PM ปิดงานไม่ได้', async () => {
    const t = await mkTask();
    await expect(go(t.id, 'done', { userId: dev, isPm: false })).rejects.toThrow(/เฉพาะ PM/);
  });

  it('PM ปิดงานได้ และบันทึกเวลาปิด', async () => {
    const t = await mkTask();
    const r = await go(t.id, 'done', { userId: pm, isPm: true });
    expect(r.kind).toBe('close');
    expect(r.isClosed).toBe(true);

    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.isClosed).toBe(true);
    expect(after.completedAt).not.toBeNull();
  });

  it('ย้ายออกจากคอลัมน์สุดท้ายแล้วล้างเวลาปิด', async () => {
    const t = await mkTask();
    await go(t.id, 'done', { userId: pm, isPm: true });
    await go(t.id, 'doing', { userId: pm, isPm: true }, { reason: 'เจอบั๊กเพิ่ม' });
    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.completedAt, 'ยังปิดค้างอยู่ทั้งที่การ์ดกลับมาแล้ว').toBeNull();
  });

  it('คนที่ไม่ใช่ PM ย้ายไปคอลัมน์กลางได้ตามปกติ', async () => {
    const t = await mkTask();
    const r = await go(t.id, 'doing', { userId: dev, isPm: false });
    expect(r.kind).toBe('forward');
  });
});

describe('เกณฑ์ 2 · ลากถอยหลังต้องใส่เหตุผล', () => {
  it('ไม่ใส่เหตุผลถูกปฏิเสธ', async () => {
    const t = await mkTask();
    await go(t.id, 'review', { userId: dev, isPm: false });
    await expect(go(t.id, 'doing', { userId: qa, isPm: false })).rejects.toThrow(/ต้องใส่เหตุผล/);
  });

  it('เหตุผลเป็นช่องว่างล้วนก็ไม่ผ่าน', async () => {
    const t = await mkTask();
    await go(t.id, 'review', { userId: dev, isPm: false });
    await expect(go(t.id, 'doing', { userId: qa, isPm: false }, { reason: '   ' })).rejects.toThrow(
      /ต้องใส่เหตุผล/,
    );
  });

  it('ใส่เหตุผลแล้วผ่าน และเหตุผลโผล่ในคอมเมนต์ให้เห็นในหน้าการ์ด', async () => {
    const t = await mkTask();
    await go(t.id, 'review', { userId: dev, isPm: false });
    await go(t.id, 'doing', { userId: qa, isPm: false }, { reason: 'ส่วนลดซ้อนกันยังคำนวณผิด' });

    const cs = await asTenant((tx) => listComments(tx, t.id));
    expect(cs.some((c) => c.isSystem && c.body.includes('ส่วนลดซ้อนกัน'))).toBe(true);

    const h = await asTenant((tx) => taskHistory(tx, t.id));
    expect(h[0]?.reason).toBe('ส่วนลดซ้อนกันยังคำนวณผิด');
  });

  it('ย้ายไปข้างหน้าไม่ต้องมีเหตุผล', async () => {
    const t = await mkTask();
    const r = await go(t.id, 'doing', { userId: dev, isPm: false });
    expect(r.kind).toBe('forward');
  });
});

describe('เกณฑ์ 3 · ตีกลับแล้วการ์ดกลับไปหาเจ้าของคนก่อน', () => {
  it('อ่านเจ้าของคนก่อนจาก task_events ไม่ใช่เก็บไว้เป็นคอลัมน์', async () => {
    const t = await mkTask();
    // เดฟรับงาน
    await go(t.id, 'doing', { userId: dev, isPm: false }, { assigneeId: dev });
    // ส่งให้คิวเอตรวจ
    await go(t.id, 'review', { userId: dev, isPm: false }, { assigneeId: qa });

    const beforeBounce = await asTenant((tx) => getTask(tx, t.id));
    expect(beforeBounce.assigneeId).toBe(qa);

    // คิวเอตีกลับ — ต้องกลับไปหาเดฟ ไม่ใช่ค้างที่คิวเอ
    const r = await go(t.id, 'doing', { userId: qa, isPm: false }, { reason: 'ยังไม่ผ่าน' });
    expect(r.assigneeId, 'ตีกลับแล้วต้องกลับไปหาเจ้าของคนก่อน').toBe(dev);

    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.assigneeId).toBe(dev);
  });

  it('ตีกลับสองรอบ แต่ละรอบกลับไปหาคนที่ถูกต้องของรอบนั้น', async () => {
    const t = await mkTask();
    await go(t.id, 'doing', { userId: dev, isPm: false }, { assigneeId: dev });
    await go(t.id, 'review', { userId: dev, isPm: false }, { assigneeId: qa });
    const first = await go(t.id, 'doing', { userId: qa, isPm: false }, { reason: 'รอบแรก' });
    expect(first.assigneeId).toBe(dev);

    // รอบสอง เดฟส่งให้ PM ตรวจแทน
    await go(t.id, 'review', { userId: dev, isPm: false }, { assigneeId: pm });
    const second = await go(t.id, 'doing', { userId: pm, isPm: true }, { reason: 'รอบสอง' });
    expect(second.assigneeId, 'รอบสองต้องกลับไปหาเดฟเหมือนเดิม').toBe(dev);
  });
});

describe('ประวัติ · แหล่งเดียวของทุกตัวเลขในระบบ', () => {
  it('บันทึกชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้น ไม่ใช่แค่คีย์', async () => {
    const t = await mkTask();
    await go(t.id, 'doing', { userId: dev, isPm: false });

    const h = await asTenant((tx) => taskHistory(tx, t.id));
    const latest = h[0];
    expect(latest?.fromColumnName).toBe('รอเริ่ม');
    expect(latest?.toColumnName).toBe('กำลังทำ');
    expect(latest?.fromColumnIndex).toBe(0);
    expect(latest?.toColumnIndex).toBe(1);
  });

  it('เปลี่ยนชื่อคอลัมน์ทีหลังแล้วประวัติเดิมยังอ่านได้ถูก', async () => {
    const t = await mkTask();
    await go(t.id, 'doing', { userId: dev, isPm: false });

    // เปลี่ยนชื่อคอลัมน์ทั้งบอร์ด
    await asTenant(async (tx) => {
      await tx.execute(sql`
        update projects set board = '[
          {"key":"todo","name":"ชื่อใหม่ 1"},{"key":"doing","name":"ชื่อใหม่ 2"},
          {"key":"review","name":"ชื่อใหม่ 3"},{"key":"done","name":"ชื่อใหม่ 4"}
        ]'::jsonb where id = ${projectId}
      `);
    });

    const h = await asTenant((tx) => taskHistory(tx, t.id));
    expect(h[0]?.toColumnName, 'ประวัติต้องเก็บชื่อ ณ ตอนนั้น ไม่ใช่ join ใหม่').toBe('กำลังทำ');
  });

  it('ทุกการย้ายเขียนประวัติหนึ่งแถวเสมอ', async () => {
    const t = await mkTask();
    await go(t.id, 'doing', { userId: dev, isPm: false });
    await go(t.id, 'review', { userId: dev, isPm: false });
    await go(t.id, 'done', { userId: pm, isPm: true });

    const h = await asTenant((tx) => taskHistory(tx, t.id));
    // 1 แถวตอนสร้าง + 3 แถวตอนย้าย
    expect(h).toHaveLength(4);
  });
});

describe('ทางที่ต้องปิด', () => {
  it('ย้ายไปคอลัมน์ที่ไม่มีบนบอร์ดไม่ได้', async () => {
    const t = await mkTask();
    await expect(go(t.id, 'ไม่มีคอลัมน์นี้', { userId: pm, isPm: true })).rejects.toThrow(/ไม่มีคอลัมน์/);
  });

  it('ย้ายไปคอลัมน์เดิมไม่ได้', async () => {
    const t = await mkTask();
    await expect(go(t.id, 'todo', { userId: pm, isPm: true })).rejects.toThrow(/อยู่คอลัมน์นี้อยู่แล้ว/);
  });

  it('ย้ายโดยไม่ผ่านประตู ถูก trigger ที่ฐานข้อมูลปฏิเสธ', async () => {
    const t = await mkTask();
    let caught: unknown;
    try {
      await asTenant(async (tx) => {
        await tx.execute(sql`update tasks set column_key = 'done' where id = ${t.id}`);
      });
    } catch (e) {
      caught = e;
    }
    expect(caught, 'ต้องมีด่านที่ชั้นฐานข้อมูลด้วย ไม่ใช่แค่ชั้นแอป').toBeDefined();
  });

  it('คำตอบ "จะเสร็จเมื่อไร" ถูกล้างเมื่อย้ายคอลัมน์', async () => {
    const t = await mkTask();
    await asTenant(async (tx) => {
      await tx.execute(sql`update tasks set eta = 'today' where id = ${t.id}`);
    });
    await go(t.id, 'doing', { userId: dev, isPm: false });
    const after = await asTenant((tx) => getTask(tx, t.id));
    expect(after.eta, 'คำตอบของคอลัมน์เดิมใช้ไม่ได้แล้ว').toBeNull();
  });
});
