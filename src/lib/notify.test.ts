/**
 * เกณฑ์ผ่านของระบบแจ้งเตือน
 *
 * ═══ ข้อที่สำคัญที่สุดคือ "แจ้งเตือนล้มต้องไม่พางานหลักล้ม" ═══
 * `notify()` ถูกเรียกในธุรกรรมเดียวกับการย้ายการ์ด
 * ถ้ามันโยนข้อผิดพลาดขึ้นไป การย้ายการ์ดจะถูกยกเลิกไปด้วย
 * ซึ่งแย่กว่าไม่ได้อีเมลมาก — เทสต์ชุดนี้พิสูจน์ว่าไม่มีทางเกิดขึ้น
 */

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import { findMentioned, notify } from './notify';
import { createClient, createProject } from './projects';
import { addComment, createTask } from './tasks';
import { transition } from './transition';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let projectId = '';
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

beforeEach(async () => {
  // ไม่มีคีย์ = ไม่ยิงออกเน็ตระหว่างเทสต์ · เทสต์ต้องไม่พึ่งบริการภายนอก
  process.env.RESEND_API_KEY = '';

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
    .values({ name: 'ทดสอบแจ้งเตือน', slug: 'notifytesten' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values([
      { email: 'pm@notify.co', name: 'พีเอ็ม', passwordHash: 'x' },
      { email: 'dev@notify.co', name: 'เดฟ', passwordHash: 'x' },
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
    return createProject(tx, tenantId, {
      key: 'NTF',
      name: 'โปรเจกต์',
      clientId: c?.id ?? '',
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
    });
  });
  projectId = made?.id ?? '';

  const b = await asTenant((tx) =>
    tx.select({ board: s.projects.board }).from(s.projects).where(eq(s.projects.id, projectId)),
  );
  board = (b[0]?.board as { key: string; name: string }[]) ?? [];
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

const rows = () => asTenant((tx) => tx.select().from(s.notifications));

describe('ย้ายการ์ดแล้วเกิดการแจ้งเตือน', () => {
  it('ส่งต่อให้คนอื่น → assigned', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    await asColumnMove((tx) =>
      transition(
        tx,
        t.id,
        { userId: pm, isPm: true },
        { toColumnKey: board[1]?.key ?? '', assigneeId: dev },
      ),
    );

    const n = await rows();
    expect(n).toHaveLength(1);
    expect(n[0]?.kind).toBe('assigned');
    expect(n[0]?.userId, 'ต้องแจ้งคนที่รับงาน ไม่ใช่คนที่ส่ง').toBe(dev);
    expect(n[0]?.actorId).toBe(pm);
    expect((n[0]?.payload as { code: string }).code).toBe(t.code);
  });

  it('⭐ ตีกลับ → rejected ไม่ใช่ assigned', async () => {
    const t = await asTenant((tx) =>
      createTask(tx, tenantId, projectId, pm, { title: 'การ์ด', assigneeId: dev }),
    );
    await asColumnMove((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: board[1]?.key ?? '' }),
    );
    await asColumnMove((tx) =>
      transition(
        tx,
        t.id,
        { userId: dev, isPm: false },
        { toColumnKey: board[2]?.key ?? '', assigneeId: pm },
      ),
    );
    // PM ตีกลับ — การ์ดกลับไปหาเดฟ
    await asColumnMove((tx) =>
      transition(
        tx,
        t.id,
        { userId: pm, isPm: true },
        { toColumnKey: board[1]?.key ?? '', reason: 'ปุ่มยังกดไม่ติดบนมือถือ' },
      ),
    );

    const n = await rows();
    const last = n[n.length - 1];
    expect(last?.kind, 'ตีกลับกับส่งต่อเป็นคนละเรื่องสำหรับคนรับ').toBe('rejected');
    expect(last?.userId).toBe(dev);
  });

  it('ย้ายคอลัมน์โดยไม่เปลี่ยนมือ → ไม่แจ้งเตือน', async () => {
    const t = await asTenant((tx) =>
      createTask(tx, tenantId, projectId, pm, { title: 'การ์ด', assigneeId: dev }),
    );
    await asColumnMove((tx) =>
      transition(tx, t.id, { userId: dev, isPm: false }, { toColumnKey: board[1]?.key ?? '' }),
    );
    expect(await rows()).toHaveLength(0);
  });

  it('⭐ ไม่แจ้งเตือนตัวเอง', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    await asColumnMove((tx) =>
      transition(
        tx,
        t.id,
        { userId: dev, isPm: false },
        { toColumnKey: board[1]?.key ?? '', assigneeId: dev },
      ),
    );
    expect(await rows(), 'คนที่เพิ่งกดย่อมรู้อยู่แล้วว่าทำอะไรไป').toHaveLength(0);
  });
});

describe('พูดถึงคุณ', () => {
  it('พิมพ์ @อีเมล แล้วคนนั้นได้รับแจ้งเตือน', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    await asTenant((tx) =>
      addComment(tx, tenantId, t.id, pm, { body: 'ฝาก @dev@notify.co ดูหน่อยครับ' }),
    );

    const n = await rows();
    expect(n).toHaveLength(1);
    expect(n[0]?.kind).toBe('mentioned');
    expect(n[0]?.userId).toBe(dev);
  });

  it('พูดถึงตัวเองไม่แจ้ง', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    await asTenant((tx) => addComment(tx, tenantId, t.id, pm, { body: 'บันทึกไว้ @pm@notify.co' }));
    expect(await rows()).toHaveLength(0);
  });

  it('อีเมลที่ไม่มีในระบบไม่ทำให้พัง', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    await asTenant((tx) =>
      addComment(tx, tenantId, t.id, pm, { body: 'ฝาก @nobody@example.com ด้วย' }),
    );
    expect(await rows()).toHaveLength(0);
  });

  it('หาได้หลายคนในคอมเมนต์เดียว และไม่นับซ้ำ', async () => {
    const found = await asTenant((tx) =>
      findMentioned(tx, '@pm@notify.co กับ @dev@notify.co และ @dev@notify.co อีกรอบ'),
    );
    expect(found.sort()).toEqual([pm, dev].sort());
  });
});

describe('⭐ แจ้งเตือนล้มต้องไม่พางานหลักล้ม', () => {
  it('ผู้รับที่ไม่มีอยู่จริง → ไม่โยนข้อผิดพลาด และไม่บันทึกอะไร', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    const done = await asTenant((tx) =>
      notify(tx, {
        tenantId,
        taskId: t.id,
        actorId: pm,
        recipientId: '00000000-0000-0000-0000-000000000000',
        kind: 'assigned',
      }),
    );
    expect(done).toBe(false);
    expect(await rows()).toHaveLength(0);
  });

  it('การ์ดที่ไม่มีอยู่จริง → ไม่โยนข้อผิดพลาด', async () => {
    const done = await asTenant((tx) =>
      notify(tx, {
        tenantId,
        taskId: '00000000-0000-0000-0000-000000000000',
        actorId: pm,
        recipientId: dev,
        kind: 'assigned',
      }),
    );
    expect(done).toBe(false);
  });

  it('คนที่ถูกปิดบัญชีไม่ได้รับแจ้งเตือน', async () => {
    await ownerDb.update(s.users).set({ isActive: false }).where(eq(s.users.id, dev));
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'การ์ด' }));
    const done = await asTenant((tx) =>
      notify(tx, { tenantId, taskId: t.id, actorId: pm, recipientId: dev, kind: 'assigned' }),
    );
    expect(done).toBe(false);
  });
});
