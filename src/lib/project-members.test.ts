/**
 * เกณฑ์ผ่านของ M12 — สิทธิ์รายโปรเจกต์และโควตา
 *
 * เกณฑ์ 1 · กฎข้อ 7 · ปิดโปรเจกต์คืนโควตาโดยไม่ลบอะไรเลย
 * เกณฑ์ 2 · กฎข้อ 10 · ผลลัพธ์สิทธิ์มาจาก resolveAccess() ตัวเดียว
 * เกณฑ์ 3 · แขกเห็นเฉพาะโปรเจกต์ที่ถูกเชิญ
 */

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import type { TenantContext } from '@/lib/api/context';
import { loadProject, visibleProjectIds } from '@/lib/api/project-access';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import { ApiError } from './api/errors';
import {
  addProjectMember,
  archiveProject,
  projectAccessView,
  removeProjectMember,
  setProjectAccess,
  setProjectMemberAccess,
} from './project-members';
import { createClient, createProject } from './projects';
import { createTask } from './tasks';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let clientId = '';
let acm = '';
let bta = '';
let owner = '';
let pm = '';
let dev = '';
let guest = '';

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

const ctxOf = (userId: string, role: TenantContext['role']): TenantContext => ({
  userId,
  email: 'x@test.co',
  name: 'ผู้ใช้',
  tenantId,
  tenantName: 'ทดสอบ',
  slug: 'm12testtenan',
  role,
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
    .values({ name: 'ทดสอบ M12', slug: 'm12testtenan', plan: 'free' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values([
      { email: 'owner@m12.co', name: 'เจ้าของ', passwordHash: 'x' },
      { email: 'pm@m12.co', name: 'พีเอ็ม', passwordHash: 'x' },
      { email: 'dev@m12.co', name: 'เดฟ', passwordHash: 'x' },
      { email: 'guest@m12.co', name: 'แขก', passwordHash: 'x' },
    ])
    .returning({ id: s.users.id });
  owner = us[0]?.id ?? '';
  pm = us[1]?.id ?? '';
  dev = us[2]?.id ?? '';
  guest = us[3]?.id ?? '';

  await ownerDb.insert(s.memberships).values([
    { tenantId, userId: owner, role: 'owner' },
    { tenantId, userId: pm, role: 'member' },
    { tenantId, userId: dev, role: 'member' },
    { tenantId, userId: guest, role: 'guest' },
  ]);

  const made = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    const cid = c?.id ?? '';
    const a = await createProject(tx, tenantId, {
      key: 'ACM',
      name: 'โปรเจกต์หนึ่ง',
      clientId: cid,
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
    });
    const b = await createProject(tx, tenantId, {
      key: 'BTA',
      name: 'โปรเจกต์สอง',
      clientId: cid,
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
    });
    return { cid, a: a?.id ?? '', b: b?.id ?? '' };
  });
  clientId = made.cid;
  acm = made.a;
  bta = made.b;
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

describe('⭐ เกณฑ์ 1 · กฎข้อ 7 · ปิดโปรเจกต์คืนโควตาโดยไม่ลบอะไรเลย', () => {
  it('ปิดแล้วการ์ดกับประวัติยังอยู่ครบ', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, acm, pm, { title: 'การ์ดสำคัญ' }));

    await asTenant((tx) => archiveProject(tx, tenantId, acm, true));

    const tasksLeft = await asTenant((tx) =>
      tx.select({ id: s.tasks.id }).from(s.tasks).where(eq(s.tasks.projectId, acm)),
    );
    const eventsLeft = await asTenant((tx) =>
      tx.select({ id: s.taskEvents.id }).from(s.taskEvents).where(eq(s.taskEvents.taskId, t.id)),
    );
    expect(tasksLeft, 'ปิดโปรเจกต์ต้องไม่ลบการ์ด').toHaveLength(1);
    expect(eventsLeft.length, 'ปิดโปรเจกต์ต้องไม่ลบประวัติ').toBeGreaterThan(0);

    const proj = await asTenant((tx) =>
      tx.select({ a: s.projects.isArchived }).from(s.projects).where(eq(s.projects.id, acm)),
    );
    expect(proj[0]?.a).toBe(true);
  });

  it('ปิดแล้วโควตาว่างขึ้นทันที', async () => {
    const before = await asTenant((tx) => archiveProject(tx, tenantId, acm, true));
    expect(before.limit).toBe(3);
    expect(before.openProjects).toBe(1);

    // แผนฟรีเปิดได้ 3 · ตอนนี้เปิดอยู่ 1 จึงสร้างเพิ่มได้
    const made = await asTenant((tx) =>
      createProject(tx, tenantId, {
        key: 'NEW',
        name: 'ใหม่',
        clientId,
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      }),
    );
    expect(made?.id).toBeTruthy();
  });

  it('เกินโควตาแล้วสร้างใหม่ไม่ได้ แต่ของเดิมยังอยู่', async () => {
    await asTenant((tx) =>
      createProject(tx, tenantId, {
        key: 'THR',
        name: 'สาม',
        clientId,
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      }),
    );
    await expect(
      asTenant((tx) =>
        createProject(tx, tenantId, {
          key: 'FOU',
          name: 'สี่',
          clientId,
          startsOn: '2026-01-01',
          dueOn: '2026-12-31',
        }),
      ),
    ).rejects.toThrow(/เปิดได้ 3 โปรเจกต์/);

    const still = await asTenant((tx) => tx.select({ id: s.projects.id }).from(s.projects));
    expect(still, 'ถูกปฏิเสธแล้วของเดิมต้องยังอยู่ครบ').toHaveLength(3);
  });

  it('เปิดคืนตอนโควตาเต็มไม่ได้ — แต่ข้อมูลยังอยู่', async () => {
    await asTenant((tx) => archiveProject(tx, tenantId, acm, true));
    await asTenant((tx) =>
      createProject(tx, tenantId, {
        key: 'THR',
        name: 'สาม',
        clientId,
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      }),
    );
    await asTenant((tx) =>
      createProject(tx, tenantId, {
        key: 'FOU',
        name: 'สี่',
        clientId,
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      }),
    );
    await expect(asTenant((tx) => archiveProject(tx, tenantId, acm, false))).rejects.toThrow(
      /ปิดโปรเจกต์อื่นก่อน/,
    );
    const proj = await asTenant((tx) =>
      tx.select({ a: s.projects.isArchived }).from(s.projects).where(eq(s.projects.id, acm)),
    );
    expect(proj[0]?.a, 'ถูกปฏิเสธแล้วต้องยังปิดอยู่เหมือนเดิม').toBe(true);
  });

  it('⭐ อ่านแผนของ**ที่ทำงานตัวเอง** ไม่ใช่ของที่ทำงานอื่น', async () => {
    /**
     * `tenants` เป็นตารางเดียวที่ไม่มี RLS (ไม่มีคอลัมน์ tenant_id ให้ policy ยึด)
     * เคยเขียน `select plan from tenants limit 1` โดยไม่มี WHERE
     * แล้วได้แผนของที่ทำงานอื่นมาใช้จริง — เจอตอนยิง HTTP จริง ไม่ใช่ตอนเทสต์
     *
     * ═══ ลำดับของแถวสำคัญมากในเทสต์นี้ ═══
     * `limit(1)` ที่ไม่มี ORDER BY คืนแถวตามลำดับกายภาพ ซึ่งคือแถวที่ใส่ก่อน
     * ถ้าที่ทำงานที่กำลังทดสอบเป็นแถวแรกอยู่แล้ว บั๊กจะมองไม่เห็นเลย
     * (ลองแล้ว — ถอด WHERE ออกก็ยังผ่าน) จึงต้องทดสอบจากที่ทำงาน**แถวหลัง**
     *
     * แถวแรก = แผนธุรกิจ (30) · แถวที่ทดสอบ = แผนฟรี (3)
     * ถ้าลืม WHERE เมื่อไหร่ จะได้ 30 แล้วเทสต์พังทันที
     */
    await ownerDb.execute(sql`update tenants set plan = 'business' where id = ${tenantId}`);

    const second = await ownerDb
      .insert(s.tenants)
      .values({ name: 'ที่ทำงานแถวหลัง', slug: 'secondtenant', plan: 'free' })
      .returning({ id: s.tenants.id });
    const t2 = second[0]?.id ?? '';

    const u = await ownerDb
      .insert(s.users)
      .values({ email: 'owner@t2.co', name: 'เจ้าของสอง', passwordHash: 'x' })
      .returning({ id: s.users.id });
    const owner2 = u[0]?.id ?? '';
    await ownerDb.insert(s.memberships).values({ tenantId: t2, userId: owner2, role: 'owner' });

    const inT2 = <T>(fn: (tx: Tx) => Promise<T>) =>
      appDb.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.tenant_id', ${t2}, true)`);
        return fn(tx as unknown as Tx);
      });

    const made = await inT2(async (tx) => {
      const c = await createClient(tx, t2, { name: 'ลูกค้าสอง', code: 'Y' });
      const p1 = await createProject(tx, t2, {
        key: 'AAA',
        name: 'หนึ่ง',
        clientId: c?.id ?? '',
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      });
      return { clientId: c?.id ?? '', projectId: p1?.id ?? '' };
    });

    const r = await inT2((tx) => archiveProject(tx, t2, made.projectId, true));
    expect(r.limit, 'ที่ทำงานนี้แผนฟรี = 3 · ถ้าได้ 30 แปลว่าอ่านแผนของแถวแรกมา').toBe(3);
  });

  it('ปิดซ้ำไม่พัง', async () => {
    await asTenant((tx) => archiveProject(tx, tenantId, acm, true));
    const again = await asTenant((tx) => archiveProject(tx, tenantId, acm, true));
    expect(again.isArchived).toBe(true);
    expect(again.openProjects).toBe(1);
  });
});

describe('⭐ เกณฑ์ 2 · กฎข้อ 10 · ผลลัพธ์มาจาก resolveAccess() ตัวเดียว', () => {
  it('ค่าเริ่มต้น collaborate — สมาชิกเขียนได้ ผู้ชมอ่านได้ แขกไม่เห็น', async () => {
    const v = await asTenant((tx) => projectAccessView(tx, acm));
    const by = (name: string) => v.members.find((m) => m.name === name);
    expect(by('เดฟ')?.effective).toBe('write');
    expect(by('พีเอ็ม')?.effective).toBe('write');
    expect(by('เจ้าของ')?.effective).toBe('write');
    expect(by('แขก')?.effective, 'แขกที่ยังไม่ถูกเชิญต้องไม่เห็นโปรเจกต์').toBe('none');
  });

  it('ตั้งเป็น read_only แล้วสมาชิกกลายเป็นอ่านอย่างเดียว แต่ PM ยังเขียนได้', async () => {
    await asTenant((tx) => setProjectAccess(tx, acm, 'read_only'));
    const v = await asTenant((tx) => projectAccessView(tx, acm));
    expect(v.members.find((m) => m.name === 'เดฟ')?.effective).toBe('read');
    expect(v.members.find((m) => m.name === 'พีเอ็ม')?.effective, 'PM เขียนได้เสมอ').toBe('write');
    expect(v.members.find((m) => m.name === 'เจ้าของ')?.effective).toBe('write');
  });

  it('รายชื่อยกเว้นชนะค่าเริ่มต้นของโปรเจกต์', async () => {
    await asTenant((tx) => setProjectAccess(tx, acm, 'read_only'));
    await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, owner, { userId: dev, access: 'write' }),
    );
    const v = await asTenant((tx) => projectAccessView(tx, acm));
    const row = v.members.find((m) => m.name === 'เดฟ');
    expect(row?.override).toBe('write');
    expect(row?.effective).toBe('write');
  });

  it('ผลลัพธ์ที่หน้าจอเห็น ตรงกับที่ loadProject() ตัดสินให้ route จริง', async () => {
    await asTenant((tx) => setProjectAccess(tx, acm, 'read_only'));
    await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, owner, { userId: dev, access: 'write' }),
    );

    const shown = await asTenant((tx) => projectAccessView(tx, acm));
    const real = await asTenant((tx) => loadProject(tx, ctxOf(dev, 'member'), acm));
    expect(
      shown.members.find((m) => m.name === 'เดฟ')?.effective,
      'ถ้าสองค่านี้ต่างกันเมื่อไหร่ ตารางบนหน้า 45 กำลังโกหก',
    ).toBe(real.access);
  });

  it('เปลี่ยนแถวยกเว้น และถอดออกได้', async () => {
    await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, owner, { userId: dev, access: 'read' }),
    );
    await asTenant((tx) => setProjectMemberAccess(tx, acm, dev, 'write'));
    let v = await asTenant((tx) => projectAccessView(tx, acm));
    expect(v.members.find((m) => m.name === 'เดฟ')?.override).toBe('write');

    await asTenant((tx) => removeProjectMember(tx, acm, dev));
    v = await asTenant((tx) => projectAccessView(tx, acm));
    expect(v.members.find((m) => m.name === 'เดฟ')?.override).toBeNull();
    // กลับไปใช้ค่าเริ่มต้นของโปรเจกต์
    expect(v.members.find((m) => m.name === 'เดฟ')?.effective).toBe('write');
  });

  it('ถอด PM ไม่ได้', async () => {
    await expect(asTenant((tx) => removeProjectMember(tx, acm, pm))).rejects.toThrow(/เป็น PM/);
  });

  it('ตั้งค่าที่ไม่ใช่ read/write ไม่ได้', async () => {
    await expect(
      asTenant((tx) =>
        addProjectMember(tx, tenantId, acm, owner, {
          userId: dev,
          access: 'collaborate' as never,
        }),
      ),
    ).rejects.toThrow(ApiError);
  });

  it('การ์ดที่ถืออยู่คืนเป็นรหัส ไม่ใช่จำนวน (กฎข้อ 9)', async () => {
    const t = await asTenant((tx) =>
      createTask(tx, tenantId, acm, pm, { title: 'ก', assigneeId: dev }),
    );
    const v = await asTenant((tx) => projectAccessView(tx, acm));
    expect(v.members.find((m) => m.name === 'เดฟ')?.holding).toEqual([t.code]);
  });
});

describe('เกณฑ์ 3 · แขกเห็นเฉพาะโปรเจกต์ที่ถูกเชิญ', () => {
  it('เชิญเข้าโปรเจกต์เดียว แล้วเห็นแค่ใบนั้น', async () => {
    await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, pm, { userId: guest, access: 'read' }),
    );

    const seen = await asTenant((tx) => visibleProjectIds(tx, ctxOf(guest, 'guest')));
    expect(seen).toEqual([acm]);

    // เปิดใบที่ไม่ได้ถูกเชิญต้องได้ 404 ไม่ใช่ 403
    await expect(asTenant((tx) => loadProject(tx, ctxOf(guest, 'guest'), bta))).rejects.toThrow(
      /ไม่พบ|not found/i,
    );
  });

  it('สมาชิกทั่วไปเห็นทุกโปรเจกต์โดยไม่ต้องมีแถว', async () => {
    const seen = await asTenant((tx) => visibleProjectIds(tx, ctxOf(dev, 'member')));
    expect(seen.sort()).toEqual([acm, bta].sort());
  });

  it('ถอดแขกออกแล้วไม่เห็นอะไรเลย', async () => {
    await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, pm, { userId: guest, access: 'read' }),
    );
    await asTenant((tx) => removeProjectMember(tx, acm, guest));
    const seen = await asTenant((tx) => visibleProjectIds(tx, ctxOf(guest, 'guest')));
    expect(seen).toEqual([]);
  });

  it('เชิญคนนอกด้วยอีเมล ได้คำเชิญบทบาทแขก · ยังไม่มีแถวยกเว้นจนกว่าจะกดรับ', async () => {
    const r = await asTenant((tx) =>
      addProjectMember(tx, tenantId, acm, pm, { email: 'outsider@example.com', access: 'read' }),
    );
    expect(r.userId).toBeNull();
    expect(r.inviteToken).toBeTruthy();

    const inv = await ownerDb.execute<{ role: string; email: string }>(sql`
      select role, email from invitations where tenant_id = ${tenantId}
    `);
    expect([...inv][0]?.role).toBe('guest');

    const rows = await asTenant((tx) =>
      tx.select({ id: s.projectMembers.id }).from(s.projectMembers),
    );
    expect(rows, 'ยังไม่มี user_id ให้อ้าง จึงยังไม่มีแถวยกเว้น').toHaveLength(0);
  });
});
