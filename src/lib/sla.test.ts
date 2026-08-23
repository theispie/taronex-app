/**
 * เกณฑ์ผ่านของ M10 — นาฬิกา SLA
 *
 * เกณฑ์ 1 · นาฬิกาเริ่มเดินตอนลูกค้ากดส่ง ไม่ใช่ตอนเจ้าหน้าที่กดรับเรื่อง
 * เกณฑ์ 2 · หยุด 2 วันแล้วเดินต่อ ยอดรวมต้องไม่นับ 2 วันนั้น
 * เกณฑ์ 3 · เปลี่ยนนโยบายแล้วเรื่องเก่าใช้ค่าเดิม
 *
 * เวลาทำการอยู่ที่ business-hours.test.ts แยกต่างหาก (14 ข้อ)
 * ไฟล์นี้พิสูจน์เฉพาะการต่อกันของนาฬิกากับฐานข้อมูล
 */

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { createClient, createProject } from './projects';
import {
  clockStatus,
  deliverProject,
  pauseClock,
  resumeClock,
  saveContract,
  slaOverview,
  triage,
  triageQueue,
} from './sla';
import { createTask } from './tasks';

const APP_URL = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const OWNER_URL =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let clientId = '';
let projectId = '';
let pm = '';

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
  // เวลาทำการ จ–ศ 09:00–18:00 · วันละ 540 นาที
  const t = await ownerDb
    .insert(s.tenants)
    .values({
      name: 'ทดสอบ M10',
      slug: 'm10testtenan',
      businessHours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: 'TH' },
    })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values({ email: 'pm@m10.co', name: 'พีเอ็ม', passwordHash: 'x' })
    .returning({ id: s.users.id });
  pm = us[0]?.id ?? '';

  const made = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' });
    const p = await createProject(tx, tenantId, {
      key: 'ACM',
      name: 'โปรเจกต์',
      clientId: c?.id ?? '',
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    });
    return { clientId: c?.id ?? '', projectId: p?.id ?? '' };
  });
  clientId = made.clientId;
  projectId = made.projectId;
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

/** การ์ดประกันหนึ่งใบ พร้อมนาฬิกาที่เริ่มเดินตามเวลาที่กำหนด */
async function warrantyTask(submittedAt: Date, priority: 'high' | 'low' = 'high') {
  return asTenant((tx) =>
    createTask(tx, tenantId, projectId, pm, {
      title: 'ลูกค้าแจ้งบั๊ก',
      origin: 'warranty',
      priority,
      submittedAt,
    }),
  );
}

/** ย้อนเวลาเหตุการณ์ — เลียนแบบว่าเรื่องนี้เกิดขึ้นเมื่อวานหรือเมื่อสองวันก่อน */
async function backdate(clockKind: string, at: Date, taskId: string) {
  await ownerDb.execute(sql`
    update sla_clock_events set at = ${at.toISOString()}
     where kind = ${clockKind}
       and clock_id = (select id from sla_clocks where task_id = ${taskId})
  `);
}

describe('เกณฑ์ 1 · นาฬิกาเริ่มเดินตอนลูกค้ากดส่ง', () => {
  it('การ์ดประกันได้นาฬิกาทันทีที่สร้าง โดยไม่ต้องมีใครกดรับเรื่อง', async () => {
    // ศุกร์ 21 ส.ค. 2569 10:00 — ในเวลาทำการ
    const sent = new Date('2026-08-21T03:00:00.000Z');
    const t = await warrantyTask(sent);

    const st = await asTenant((tx) => clockStatus(tx, t.id));
    expect(st.state).toBe('running');
    // ยังไม่มีใครกดรับเรื่อง portal_stage ยังว่าง
    const rows = await asTenant((tx) =>
      tx.select({ ps: s.tasks.portalStage }).from(s.tasks).where(eq(s.tasks.id, t.id)),
    );
    expect(rows[0]?.ps).toBeNull();
    expect(st.segments[0]?.kind).toBe('start');
  });

  it('การ์ดส่งมอบปกติไม่มีนาฬิกา', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งานปกติ' }));
    await expect(asTenant((tx) => clockStatus(tx, t.id))).rejects.toThrow(/ยังไม่มีนาฬิกา/);
  });

  it('เรื่องที่ยังไม่มีใครกดรับ ขึ้นก่อนเรื่องที่เหลือเวลาน้อยกว่า', async () => {
    const urgent = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'), 'high');
    const calm = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'), 'low');
    // เรื่องเร่งด่วนถูกกดรับแล้ว เรื่องเรื่อยๆ ยังไม่มีใครแตะ
    // ผ่านประตูเดียวกับโค้ดจริง — trigger guard_portal_stage ปฏิเสธ UPDATE ตรงๆ แม้เป็นเจ้าของตาราง
    await ownerDb.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.allow_portal_stage', 'on', true)`);
      await tx.execute(sql`update tasks set portal_stage = 'received' where id = ${urgent.id}`);
    });

    const rows = await asTenant((tx) => slaOverview(tx, tenantId));
    expect(rows[0]?.taskId).toBe(calm.id);
    expect(rows[0]?.unclaimed).toBe(true);
    // ถึงจะเหลือเวลาเยอะกว่าก็ยังขึ้นก่อน
    expect(rows[0]?.remainingMinutes).toBeGreaterThan(rows[1]?.remainingMinutes ?? 0);
  });
});

describe('เกณฑ์ 2 · หยุด 2 วันแล้วเดินต่อ ยอดรวมถูกต้อง', () => {
  it('เวลาช่วงที่หยุดไม่ถูกนับ', async () => {
    // จันทร์ 17 ส.ค. 2569 09:00 (02:00Z) — ต้นสัปดาห์
    const sent = new Date('2026-08-17T02:00:00.000Z');
    const t = await warrantyTask(sent);
    await backdate('start', sent, t.id);

    // ทำไป 3 ชั่วโมง แล้วหยุดรอลูกค้าตอบ (จันทร์ 12:00)
    await asTenant((tx) => pauseClock(tx, t.id, 'pause_customer', 'รอลูกค้าส่งภาพหน้าจอ', pm));
    await backdate('pause_customer', new Date('2026-08-17T05:00:00.000Z'), t.id);

    // ลูกค้าตอบกลับพุธ 12:00 — หยุดไป 2 วันเต็ม
    await asTenant((tx) => resumeClock(tx, t.id, pm));
    await backdate('resume', new Date('2026-08-19T05:00:00.000Z'), t.id);

    // ทำต่ออีก 2 ชั่วโมงแล้วปิด (พุธ 14:00)
    await asTenant((tx) => pauseClock(tx, t.id, 'pause_vendor', 'รอผู้ให้บริการ', pm));
    await backdate('pause_vendor', new Date('2026-08-19T07:00:00.000Z'), t.id);

    const st = await asTenant((tx) => clockStatus(tx, t.id));
    // 3 ชม. + 2 ชม. = 300 นาที · ไม่ใช่ 2 วัน 5 ชั่วโมง
    expect(st.usedMinutes).toBe(300);
    expect(st.state).toBe('paused');
  });

  it('หยุดโดยไม่บอกเหตุผลไม่ได้', async () => {
    const t = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));
    await expect(
      asTenant((tx) => pauseClock(tx, t.id, 'pause_customer', '   ', pm)),
    ).rejects.toThrow(/เหตุผล/);
  });

  it('เดินอยู่แล้วสั่งเดินต่ออีกไม่ได้', async () => {
    const t = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));
    await expect(asTenant((tx) => resumeClock(tx, t.id, pm))).rejects.toThrow(/ไม่ได้หยุดอยู่/);
  });
});

describe('เกณฑ์ 3 · เปลี่ยนนโยบายแล้วเรื่องเก่าใช้ค่าเดิม', () => {
  it('เรื่องที่เปิดนาฬิกาไว้ก่อนยังใช้เวลาเป้าหมายของเวอร์ชันเดิม', async () => {
    await asTenant((tx) =>
      saveContract(tx, tenantId, clientId, {
        levels: { high: { respond: 60, resolve: 480 } },
      }),
    );
    const oldTask = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));

    // ลูกค้าต่อรองใหม่ เข้มขึ้นครึ่งหนึ่ง
    const v = await asTenant((tx) =>
      saveContract(tx, tenantId, clientId, {
        levels: { high: { respond: 30, resolve: 240 } },
      }),
    );
    expect(v.version).toBe(2);

    const newTask = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));

    const before = await asTenant((tx) => clockStatus(tx, oldTask.id));
    const after = await asTenant((tx) => clockStatus(tx, newTask.id));
    expect(before.targetResolveMinutes).toBe(480);
    expect(after.targetResolveMinutes).toBe(240);
  });

  it('บันทึกนโยบายใหม่เป็นเวอร์ชันใหม่ ไม่ทับของเดิม', async () => {
    await asTenant((tx) => saveContract(tx, tenantId, clientId, {}));
    await asTenant((tx) => saveContract(tx, tenantId, clientId, { pauseOnVendor: false }));
    const rows = await asTenant((tx) => tx.select({ id: s.slaPolicies.id }).from(s.slaPolicies));
    expect(rows).toHaveLength(2);
  });
});

describe('คัดแยกงานประกัน — คนกดเท่านั้น', () => {
  it('การ์ดประกันใหม่เข้าคิวคัดแยกเสมอ ระบบไม่เดาให้', async () => {
    const t = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));
    const q = await asTenant((tx) => triageQueue(tx));
    expect(q.map((r) => r.taskId)).toContain(t.id);
  });

  it('อยู่ในประกัน — นาฬิกาเดินต่อ', async () => {
    const t = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));
    const r = await asTenant((tx) => triage(tx, t.id, 'covered', '', pm));
    expect(r.clockStopped).toBe(false);
    const st = await asTenant((tx) => clockStatus(tx, t.id));
    expect(st.state).toBe('running');
    // ออกจากคิวแล้ว
    const q = await asTenant((tx) => triageQueue(tx));
    expect(q.map((x) => x.taskId)).not.toContain(t.id);
  });

  it('นอกประกัน — ปิดนาฬิกา และต้องบอกเหตุผล', async () => {
    const t = await warrantyTask(new Date('2026-08-21T03:00:00.000Z'));
    await expect(asTenant((tx) => triage(tx, t.id, 'billable', '', pm))).rejects.toThrow(
      /เหตุผล|ทำไม/,
    );

    const r = await asTenant((tx) => triage(tx, t.id, 'billable', 'ลูกค้าขอฟีเจอร์เพิ่ม', pm));
    expect(r.clockStopped).toBe(true);
    const st = await asTenant((tx) => clockStatus(tx, t.id));
    expect(st.state).toBe('resolved');
  });

  it('เวลาที่หมดไปก่อนคัดแยกถูกแยกให้เห็น', async () => {
    const sent = new Date('2026-08-17T02:00:00.000Z'); // จันทร์ 09:00
    const t = await warrantyTask(sent);
    await backdate('start', sent, t.id);

    await asTenant((tx) => triage(tx, t.id, 'covered', '', pm));
    await ownerDb.execute(sql`
      update task_events set at = '2026-08-17T06:00:00.000Z'
       where task_id = ${t.id} and reason like 'คัดแยก:%'
    `);

    const st = await asTenant((tx) => clockStatus(tx, t.id));
    // 09:00 → 13:00 = 240 นาที กินไปกับการตัดสินใจภายใน
    expect(st.minutesBeforeTriage).toBe(240);
  });

  it('การ์ดงานส่งมอบคัดแยกไม่ได้', async () => {
    const t = await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งาน' }));
    await expect(asTenant((tx) => triage(tx, t.id, 'covered', '', pm))).rejects.toThrow(/ช่วงประกัน/);
  });
});

describe('ส่งมอบ', () => {
  it('แช่แข็งตัวเลข เปิดพอร์ทัล และเริ่มสัญญา', async () => {
    await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งาน 1' }));
    await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งาน 2' }));

    const r = await asTenant((tx) => deliverProject(tx, tenantId, projectId, {}));
    expect(r.portalEnabled).toBe(true);
    expect(r.healthSnapshot.deliveryTasks).toBe(2);

    const rows = await asTenant((tx) =>
      tx
        .select({ pe: s.projects.portalEnabled, hs: s.projects.healthSnapshot })
        .from(s.projects)
        .where(eq(s.projects.id, projectId)),
    );
    expect(rows[0]?.pe).toBe(true);
    expect((rows[0]?.hs as { deliveryTasks: number }).deliveryTasks).toBe(2);

    // การ์ดที่เข้ามาหลังส่งมอบไม่ทำให้ตัวเลขที่แช่แข็งไว้เปลี่ยน
    await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งาน 3' }));
    const again = await asTenant((tx) =>
      tx
        .select({ hs: s.projects.healthSnapshot })
        .from(s.projects)
        .where(eq(s.projects.id, projectId)),
    );
    expect((again[0]?.hs as { deliveryTasks: number }).deliveryTasks).toBe(2);
  });

  it('ส่งมอบซ้ำไม่ได้', async () => {
    await asTenant((tx) => deliverProject(tx, tenantId, projectId, {}));
    await expect(asTenant((tx) => deliverProject(tx, tenantId, projectId, {}))).rejects.toThrow(
      /ส่งมอบไปแล้ว/,
    );
  });

  it('วันสิ้นสุดประกันก่อนวันส่งมอบไม่ได้', async () => {
    await expect(
      asTenant((tx) => deliverProject(tx, tenantId, projectId, { endsOn: '2020-01-01' })),
    ).rejects.toThrow(/หลังวันส่งมอบ/);
  });
});
