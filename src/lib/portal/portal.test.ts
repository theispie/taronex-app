/**
 * เกณฑ์ผ่านของ M11 — พอร์ทัลลูกค้า
 *
 * เกณฑ์ 1 · ลิงก์ใช้ได้ครั้งเดียว
 * เกณฑ์ 2 · ผู้ติดต่อเห็นเฉพาะเรื่องของตัวเอง และข้ามที่ทำงานไม่ได้
 * เกณฑ์ 3 · serializer ไม่ปล่อยข้อมูลภายในออกไป (กฎข้อ 6)
 * เกณฑ์ 4 · สถานะพอร์ทัลไม่ขยับเองเมื่อการ์ดย้ายคอลัมน์ (ไม่มี auto)
 */

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import { addContact, createClient, createProject } from '@/lib/projects';
import { deliverProject } from '@/lib/sla';
import { createTask } from '@/lib/tasks';
import { transition } from '@/lib/transition';
import { TEST_APP_URL as APP_URL, TEST_OWNER_URL as OWNER_URL } from '@/test/db';
import { createIssue, requestLink, verifyLink } from './intake';
import { findIssueByCode, listPortalIssues, portalIssueDetail } from './serializer';
import type { PortalContact } from './session';
import { setPortalStage } from './stage';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let clientId = '';
let projectId = '';
let pm = '';
let somying = ''; // ผู้ติดต่อคนที่ 1 · เห็นเฉพาะเรื่องตัวเอง
let somchai = ''; // ผู้ติดต่อคนที่ 2 · เห็นทั้งบริษัท

const asTenant = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

/** เลียนแบบ withPortalStageChange() ในโค้ดจริง */
const asStageChange = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_portal_stage', 'on', true)`);
    return fn(tx as unknown as Tx);
  });

const asColumnMove = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.allow_column_move', 'on', true)`);
    return fn(tx as unknown as Tx);
  });

const contactOf = (id: string, canSeeAll = false): PortalContact => ({
  tenantId,
  contactId: id,
  clientId,
  clientName: 'ทองไทย มีเดีย',
  name: 'ผู้ติดต่อ',
  email: 'x@thongthai.co.th',
  canReport: true,
  canSeeAll,
  tenantName: 'ดิจิทัลเอ็กซ์',
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
    .values({ name: 'ดิจิทัลเอ็กซ์', slug: 'm11testtenan' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';

  const us = await ownerDb
    .insert(s.users)
    .values({ email: 'pm@m11.co', name: 'พีเอ็ม', passwordHash: 'x' })
    .returning({ id: s.users.id });
  pm = us[0]?.id ?? '';

  const made = await asTenant(async (tx) => {
    const c = await createClient(tx, tenantId, { name: 'ทองไทย มีเดีย', code: 'T' });
    const cid = c?.id ?? '';
    const p = await createProject(tx, tenantId, {
      key: 'TT',
      name: 'เว็บไซต์',
      clientId: cid,
      pmUserId: pm,
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    });
    const a = await addContact(tx, tenantId, cid, {
      email: 'somying@thongthai.co.th',
      name: 'คุณสมหญิง',
    });
    const b = await addContact(tx, tenantId, cid, {
      email: 'somchai@thongthai.co.th',
      name: 'คุณสมชาย',
      canSeeAll: true,
    });
    return { clientId: cid, projectId: p?.id ?? '', a: a?.id ?? '', b: b?.id ?? '' };
  });
  clientId = made.clientId;
  projectId = made.projectId;
  somying = made.a;
  somchai = made.b;

  // ต้องส่งมอบก่อน พอร์ทัลถึงเปิด
  await asTenant((tx) => deliverProject(tx, tenantId, projectId, {}));
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

describe('เกณฑ์ 1 · ลิงก์เข้าใช้งานใช้ได้ครั้งเดียว', () => {
  it('อีเมลที่ลงทะเบียนไว้ได้โทเคน · แลกได้ครั้งเดียว', async () => {
    const link = await asTenant((tx) => requestLink(tx, tenantId, 'somying@thongthai.co.th'));
    expect(link).not.toBeNull();

    const cid = await asTenant((tx) => verifyLink(tx, tenantId, link?.token ?? ''));
    expect(cid).toBe(somying);

    // ครั้งที่สองต้องไม่ผ่าน
    await expect(asTenant((tx) => verifyLink(tx, tenantId, link?.token ?? ''))).rejects.toThrow(
      /ใช้ไปแล้วหรือหมดอายุ/,
    );
  });

  it('อีเมลที่ไม่ได้ลงทะเบียนคืน null — ตัวเรียกต้องตอบข้อความเดียวกัน', async () => {
    const link = await asTenant((tx) => requestLink(tx, tenantId, 'stranger@example.com'));
    expect(link).toBeNull();
  });

  it('ตัวพิมพ์ใหญ่เล็กไม่สำคัญ', async () => {
    const link = await asTenant((tx) => requestLink(tx, tenantId, ' SomYing@ThongThai.co.th '));
    expect(link?.contactId).toBe(somying);
  });

  it('โทเคนหมดอายุแล้วใช้ไม่ได้', async () => {
    const link = await asTenant((tx) => requestLink(tx, tenantId, 'somying@thongthai.co.th'));
    await ownerDb.execute(sql`
      update portal_tokens set expires_at = now() - interval '1 hour'
    `);
    await expect(asTenant((tx) => verifyLink(tx, tenantId, link?.token ?? ''))).rejects.toThrow();
  });
});

describe('เกณฑ์ 2 · เห็นเฉพาะเรื่องของตัวเอง', () => {
  it('ผู้ติดต่อธรรมดาไม่เห็นเรื่องที่คนอื่นแจ้ง', async () => {
    await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องของสมหญิง' }));
    await asTenant((tx) => createIssue(tx, contactOf(somchai), { title: 'เรื่องของสมชาย' }));

    const mine = await asTenant((tx) =>
      listPortalIssues(tx, { clientId, contactId: somying, canSeeAll: false }),
    );
    expect(mine.open.map((i) => i.title)).toEqual(['เรื่องของสมหญิง']);

    // canSeeAll เห็นทั้งบริษัท
    const all = await asTenant((tx) =>
      listPortalIssues(tx, { clientId, contactId: somchai, canSeeAll: true }),
    );
    expect(all.open).toHaveLength(2);
  });

  it('เดารหัสของคนอื่นแล้วหาไม่เจอ — 404 ไม่ใช่ 403', async () => {
    const other = await asTenant((tx) =>
      createIssue(tx, contactOf(somchai), { title: 'เรื่องของสมชาย' }),
    );
    const found = await asTenant((tx) =>
      findIssueByCode(tx, {
        clientId,
        contactId: somying,
        canSeeAll: false,
        code: other.code,
      }),
    );
    expect(found).toBeNull();
  });

  it('งานส่งมอบปกติไม่โผล่ในพอร์ทัล ต่อให้อยู่โปรเจกต์เดียวกัน', async () => {
    await asTenant((tx) => createTask(tx, tenantId, projectId, pm, { title: 'งานภายใน' }));
    const list = await asTenant((tx) =>
      listPortalIssues(tx, { clientId, contactId: somchai, canSeeAll: true }),
    );
    expect(list.open).toHaveLength(0);
  });

  it('โปรเจกต์ที่ยังไม่ส่งมอบไม่รับแจ้งเรื่อง', async () => {
    const other = await asTenant(async (tx) => {
      const p = await createProject(tx, tenantId, {
        key: 'NEW',
        name: 'ยังไม่ส่งมอบ',
        clientId,
        pmUserId: pm,
        startsOn: '2026-01-01',
        dueOn: '2026-12-31',
      });
      return p?.id ?? '';
    });
    await expect(
      asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'x', projectId: other })),
    ).rejects.toThrow(/เลือกโปรเจกต์/);
  });
});

describe('เกณฑ์ 3 · serializer ไม่ปล่อยข้อมูลภายในออกไป (กฎข้อ 6)', () => {
  it('ไม่มี assignee · priority · ตัวเลข SLA · เวลาระดับนาที', async () => {
    const issue = await asTenant((tx) =>
      createIssue(tx, contactOf(somying), { title: 'ฟอร์มติดต่อส่งอีเมลไม่ออก' }),
    );
    // ตั้งของภายในให้ครบ แล้วดูว่าหลุดออกไปไหม
    await ownerDb.execute(sql`
      update tasks set assignee_id = ${pm}, priority = 'critical' where id = ${issue.id}
    `);

    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    const json = JSON.stringify(view);

    expect(json).not.toContain(pm);
    expect(json).not.toContain('critical');
    expect(json).not.toContain('assignee');
    // วันที่ต้องเป็น YYYY-MM-DD ล้วน ไม่มีชั่วโมงนาที
    expect(view?.reportedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(json).not.toMatch(/\d{2}:\d{2}/);
    // ไม่มีคำที่ส่อว่ามีนาฬิกาจับเวลาอยู่
    expect(json).not.toContain('Minutes');
    expect(json).not.toContain('sla');
  });

  it('คอมเมนต์ภายในไม่หลุดออกไป', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องหนึ่ง' }));
    await ownerDb.execute(sql`
      insert into comments (tenant_id, task_id, author_id, body, is_internal)
      values (${tenantId}, ${issue.id}, ${pm}, 'ลูกค้าคนนี้เรื่องมาก', true)
    `);
    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(JSON.stringify(view)).not.toContain('เรื่องมาก');
  });

  it('ผลคัดแยกออกไปเป็นข้อความ ไม่ใช่ค่าดิบ', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องหนึ่ง' }));
    await ownerDb.execute(sql`
      update tasks set warranty_scope = 'billable' where id = ${issue.id}
    `);
    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(view?.scopeNote).toContain('นอกขอบเขตเดิม');
    expect(JSON.stringify(view)).not.toContain('billable');
  });
});

describe('เกณฑ์ 4 · ไม่มี auto — ต้องมีคนกดเท่านั้น', () => {
  it('เรื่องใหม่ยังไม่มีสถานะ ลูกค้าเห็นว่ารอเจ้าหน้าที่รับเรื่อง', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(view?.stage).toBeNull();
    expect(view?.stageLabel).toBe('ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง');
    expect(view?.timeline.every((t) => t.date === null)).toBe(true);
  });

  it('⭐ ย้ายการ์ดข้ามคอลัมน์แล้วสถานะที่ลูกค้าเห็นต้องไม่ขยับ', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    // ย้ายไปคอลัมน์ที่สองแบบเต็มรูปแบบ ผ่านประตูเดียวกับที่หน้าเว็บใช้
    const board = await asTenant((tx) =>
      tx.select({ board: s.projects.board }).from(s.projects).where(eq(s.projects.id, projectId)),
    );
    const cols = board[0]?.board as { key: string; name: string }[];
    await asColumnMove((tx) =>
      transition(tx, issue.id, { userId: pm, isPm: true }, { toColumnKey: cols[1]?.key ?? '' }),
    );

    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(view?.stage, 'บอร์ดขยับแต่สิ่งที่ลูกค้าเห็นต้องไม่ขยับ').toBeNull();
    expect(view?.stageLabel).toBe('ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง');
  });

  it('กดรับเรื่องแล้วรับเป็นเจ้าของถ้ายังไม่มีใครถือ', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    const r = await asStageChange((tx) =>
      setPortalStage(tx, issue.id, 'received', { userId: pm, isPm: true }),
    );
    expect(r.assignedTo).toBe(pm);

    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(view?.stageLabel).toBe('รับเรื่องแล้ว');
    expect(view?.timeline[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('เปลี่ยน portal_stage นอกประตูไม่ได้ — trigger ปฏิเสธที่ชั้นฐานข้อมูล', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    // drizzle ห่อข้อผิดพลาดของฐานข้อมูลไว้ ต้องแกะ cause ถึงจะเห็นข้อความของ trigger
    // ถ้าเทียบแค่ข้อความชั้นนอก เทสต์จะผ่านแม้ query พังด้วยเหตุอื่น
    let err: unknown;
    try {
      await asTenant((tx) =>
        tx.update(s.tasks).set({ portalStage: 'resolved' }).where(eq(s.tasks.id, issue.id)),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    const cause = (err as { cause?: { message?: string } }).cause;
    expect(String(cause?.message ?? '')).toMatch(/portal-stage/);
  });

  it('"แก้ไขแล้ว" กดได้เฉพาะ PM', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    await expect(
      asStageChange((tx) => setPortalStage(tx, issue.id, 'resolved', { userId: pm, isPm: false })),
    ).rejects.toThrow(/เฉพาะ PM/);
  });

  it('ถอยสถานะที่บอกลูกค้าไปแล้วต้องมีเหตุผล', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    await asStageChange((tx) => setPortalStage(tx, issue.id, 'fixing', { userId: pm, isPm: true }));
    await expect(
      asStageChange((tx) =>
        setPortalStage(tx, issue.id, 'investigating', { userId: pm, isPm: true }),
      ),
    ).rejects.toThrow(/เหตุผล/);

    const ok = await asStageChange((tx) =>
      setPortalStage(
        tx,
        issue.id,
        'investigating',
        { userId: pm, isPm: true },
        'แก้ไม่หาย ต้องตรวจใหม่',
      ),
    );
    expect(ok.wentBackwards).toBe(true);
  });

  it('ไทม์ไลน์ยึดวันที่ครั้งแรกที่กดแต่ละขั้น', async () => {
    const issue = await asTenant((tx) => createIssue(tx, contactOf(somying), { title: 'เรื่องใหม่' }));
    await asStageChange((tx) =>
      setPortalStage(tx, issue.id, 'received', { userId: pm, isPm: true }),
    );
    await ownerDb.execute(sql`
      update task_events set at = '2026-08-01T03:00:00Z'
       where task_id = ${issue.id} and to_portal_stage = 'received'
    `);
    await asStageChange((tx) => setPortalStage(tx, issue.id, 'fixing', { userId: pm, isPm: true }));
    await asStageChange((tx) =>
      setPortalStage(tx, issue.id, 'received', { userId: pm, isPm: true }, 'กลับมาตั้งต้นใหม่'),
    );

    const view = await asTenant((tx) => portalIssueDetail(tx, issue.id));
    expect(view?.timeline.find((t) => t.key === 'received')?.date).toBe('2026-08-01');
  });
});
