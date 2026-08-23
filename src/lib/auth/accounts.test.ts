/**
 * เกณฑ์ผ่านของ M2 ตาม BUILD-PLAN — ทั้งสี่ข้ออยู่ในไฟล์นี้
 *
 *   1. สมัคร → เชิญเพื่อน → เพื่อนรับคำเชิญ → COUNT(tenants) ไม่เพิ่ม → ทั้งคู่เห็นที่ทำงานเดียวกัน
 *   2. คนหนึ่งอยู่สามที่ทำงาน ล็อกอินครั้งเดียวเข้าได้ทั้งสาม
 *   3. รับคำเชิญด้วยอีเมลที่ไม่ตรงกับ session ถูกปฏิเสธ
 *   4. เปลี่ยนรหัสแล้ว session อื่นตายหมด
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import * as s from '@/db/schema';
import {
  acceptInvitation,
  createWorkspace,
  inviteMember,
  leaveWorkspace,
  listWorkspaces,
  login,
  readInvitation,
  resetPassword,
  revokeOwner,
  signup,
} from './accounts';

const APP_URL = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const OWNER_URL =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

/** เลียนแบบ withoutTenant() — ไม่ตั้งอะไรเลย */
const anon = <T>(fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => fn(tx as unknown as Tx));

/** เลียนแบบ withNewTenant() */
const newTenant = <T>(fn: (tx: Tx, enter: (id: string) => Promise<void>) => Promise<T>) =>
  appDb.transaction(async (tx) =>
    fn(tx as unknown as Tx, async (id) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${id}, true)`);
    }),
  );

/** เลียนแบบ withAccount() — ตั้ง user แต่ไม่ตั้ง tenant */
const asAccount = <T>(userId: string, email: string, fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`select set_config('app.user_email', ${email}, true)`);
    return fn(tx as unknown as Tx);
  });

/** เลียนแบบ withTenant() */
const asTenant = <T>(tenantId: string, fn: (tx: Tx) => Promise<T>) =>
  appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Tx);
  });

async function countTenants(): Promise<number> {
  const r = await ownerDb.execute<{ n: number }>(sql`select count(*)::int as n from tenants`);
  return [...r][0]?.n ?? -1;
}
async function countSessions(userId: string): Promise<number> {
  const r = await ownerDb.execute<{ n: number }>(
    sql`select count(*)::int as n from sessions where user_id = ${userId}`,
  );
  return [...r][0]?.n ?? -1;
}

const PW = 'รหัสผ่านยาวพอ123';

beforeEach(async () => {
  await ownerDb.execute(sql`
    TRUNCATE sla_clock_events, sla_clocks, sla_policy_levels, sla_policies,
             warranty_contracts, time_entries, attachments, comments, task_events, tasks,
             project_members, features, project_phases, projects, project_templates,
             portal_tokens, client_contacts, clients, invitations, memberships,
             sessions, notifications, users, tenants
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

describe('เกณฑ์ 1 · เชิญเพื่อนแล้วต้องไม่เกิดที่ทำงานใหม่', () => {
  it('สมัคร → เชิญ → รับคำเชิญ → COUNT(tenants) ยังเท่าเดิม และเห็นที่ทำงานเดียวกัน', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, {
        companyName: 'ดิจิทัลเอกซ์',
        name: 'ณัฐ',
        email: 'nut@dx.co.th',
        password: PW,
      }),
    );
    expect(await countTenants()).toBe(1);

    // เพื่อนต้องมีบัญชีก่อน (สมัครเองที่ไหนก็ได้) — ที่นี่ให้สมัครแล้วออกจากที่ทำงานตัวเอง
    const friendUser = await ownerDb
      .insert(s.users)
      .values({ email: 'ploy@dx.co.th', name: 'พลอย', passwordHash: 'x' })
      .returning({ id: s.users.id, email: s.users.email });
    const friend = friendUser[0];
    if (!friend) throw new Error('สร้างเพื่อนไม่สำเร็จ');

    const token = await asTenant(owner.tenantId, (tx) =>
      inviteMember(tx, owner.tenantId, owner.userId, {
        email: 'ploy@dx.co.th',
        role: 'member',
        jobTitle: 'dev',
      }),
    );

    const before = await countTenants();
    const joined = await asAccount(friend.id, friend.email, (tx) =>
      acceptInvitation(tx, token, { id: friend.id, email: friend.email }),
    );

    expect(await countTenants(), 'รับคำเชิญแล้วต้องไม่เกิดที่ทำงานใหม่').toBe(before);
    expect(joined.tenantId).toBe(owner.tenantId);

    const ownerSees = await asAccount(owner.userId, 'nut@dx.co.th', (tx) =>
      listWorkspaces(tx, owner.userId),
    );
    const friendSees = await asAccount(friend.id, friend.email, (tx) =>
      listWorkspaces(tx, friend.id),
    );
    expect(ownerSees.map((w) => w.tenantId)).toEqual([owner.tenantId]);
    expect(friendSees.map((w) => w.tenantId)).toEqual([owner.tenantId]);
  });

  it('คำเชิญที่ใช้แล้วใช้ซ้ำไม่ได้', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'a@x.co', password: PW }),
    );
    const u = (
      await ownerDb
        .insert(s.users)
        .values({ email: 'b@x.co', name: 'บี', passwordHash: 'x' })
        .returning()
    )[0];
    if (!u) throw new Error('no user');

    const token = await asTenant(owner.tenantId, (tx) =>
      inviteMember(tx, owner.tenantId, owner.userId, {
        email: 'b@x.co',
        role: 'member',
        jobTitle: 'dev',
      }),
    );
    await asAccount(u.id, u.email, (tx) =>
      acceptInvitation(tx, token, { id: u.id, email: u.email }),
    );

    await expect(
      asAccount(u.id, u.email, (tx) => acceptInvitation(tx, token, { id: u.id, email: u.email })),
    ).rejects.toThrow(/ใช้ไม่ได้แล้ว/);
  });
});

describe('เกณฑ์ 2 · คนเดียวอยู่สามที่ทำงาน ล็อกอินครั้งเดียว', () => {
  it('เห็นครบทั้งสามที่จากเซสชันเดียว', async () => {
    const me = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ที่หนึ่ง', name: 'เอิร์ธ', email: 'earth@x.co', password: PW }),
    );
    await newTenant((tx, enter) => createWorkspace(tx, enter, me.userId, 'ที่สอง'));
    await newTenant((tx, enter) => createWorkspace(tx, enter, me.userId, 'ที่สาม'));

    const list = await asAccount(me.userId, 'earth@x.co', (tx) => listWorkspaces(tx, me.userId));
    expect(list).toHaveLength(3);
    expect(list.map((w) => w.name).sort()).toEqual(['ที่สอง', 'ที่สาม', 'ที่หนึ่ง']);
    expect(list.every((w) => w.role === 'owner')).toBe(true);
  });

  it('ที่ทำงานหนึ่งมองไม่เห็นว่าสมาชิกไปอยู่ที่ทำงานไหนอีกบ้าง', async () => {
    const me = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ที่หนึ่ง', name: 'เอิร์ธ', email: 'earth@x.co', password: PW }),
    );
    await newTenant((tx, enter) => createWorkspace(tx, enter, me.userId, 'ที่ลับ'));

    // ใน withTenant() ไม่ได้ตั้ง app.user_id เงื่อนไข OR จึงไม่ทำงาน
    const rows = await asTenant(me.tenantId, async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`select count(*)::int as n from memberships`);
      return [...r][0]?.n ?? -1;
    });
    expect(rows, 'เห็นเฉพาะสมาชิกของที่ทำงานนี้เท่านั้น').toBe(1);
  });
});

describe('เกณฑ์ 3 · อีเมลไม่ตรงกับ session ต้องถูกปฏิเสธ', () => {
  it('ปฏิเสธพร้อมบอกว่าคำเชิญส่งถึงใคร เพื่อให้สลับบัญชีได้', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    const token = await asTenant(owner.tenantId, (tx) =>
      inviteMember(tx, owner.tenantId, owner.userId, {
        email: 'ploy@x.co',
        role: 'member',
        jobTitle: 'dev',
      }),
    );
    const wrong = (
      await ownerDb
        .insert(s.users)
        .values({ email: 'someone@else.co', name: 'คนอื่น', passwordHash: 'x' })
        .returning()
    )[0];
    if (!wrong) throw new Error('no user');

    await expect(
      asAccount(wrong.id, wrong.email, (tx) =>
        acceptInvitation(tx, token, { id: wrong.id, email: wrong.email }),
      ),
    ).rejects.toThrow(/ploy@x.co/);

    expect(await countTenants(), 'ถูกปฏิเสธแล้วต้องไม่เกิดที่ทำงานใหม่').toBe(1);
  });

  it('อ่านคำเชิญก่อนกดรับได้ เพื่อให้หน้าจอ 44 บอกได้ว่าต้องสลับเป็นบัญชีไหน', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ดิจิทัลเอกซ์', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    const token = await asTenant(owner.tenantId, (tx) =>
      inviteMember(tx, owner.tenantId, owner.userId, {
        email: 'ploy@x.co',
        role: 'viewer',
        jobTitle: 'ba',
      }),
    );
    const view = await anon((tx) => readInvitation(tx, token));
    expect(view.tenantName).toBe('ดิจิทัลเอกซ์');
    expect(view.email).toBe('ploy@x.co');
    expect(view.role).toBe('viewer');
    expect(view.invitedByName).toBe('ณัฐ');
  });
});

describe('เกณฑ์ 4 · เปลี่ยนรหัสแล้ว session อื่นตายหมด', () => {
  it('ล็อกอินสามเครื่องแล้วตั้งรหัสใหม่ เซสชันเหลือศูนย์', async () => {
    const me = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    await anon((tx) => login(tx, 'nut@x.co', PW));
    await anon((tx) => login(tx, 'NUT@X.CO', PW)); // อีเมลไม่สนตัวพิมพ์
    expect(await countSessions(me.userId)).toBe(3);

    await anon((tx) => resetPassword(tx, me.userId, 'รหัสใหม่ที่ยาวพอ456'));
    expect(await countSessions(me.userId), 'เซสชันเก่าต้องตายหมด').toBe(0);

    await expect(anon((tx) => login(tx, 'nut@x.co', PW))).rejects.toThrow();
    await anon((tx) => login(tx, 'nut@x.co', 'รหัสใหม่ที่ยาวพอ456'));
    expect(await countSessions(me.userId)).toBe(1);
  });
});

describe('บทบาทและเจ้าของ', () => {
  it('ถอดเจ้าของคนสุดท้ายไม่ได้', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    await expect(
      asTenant(owner.tenantId, (tx) => revokeOwner(tx, owner.tenantId, owner.userId)),
    ).rejects.toThrow(/เจ้าของ/);
  });

  it('เจ้าของคนสุดท้ายออกจากที่ทำงานไม่ได้', async () => {
    const owner = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    await expect(
      asTenant(owner.tenantId, (tx) => leaveWorkspace(tx, owner.tenantId, owner.userId)),
    ).rejects.toThrow(/เจ้าของคนสุดท้าย/);
  });

  it('สมัครด้วยอีเมลซ้ำไม่ได้ และต้องไม่เกิดที่ทำงานค้าง', async () => {
    await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );
    await expect(
      newTenant((tx, enter) =>
        signup(tx, enter, { companyName: 'ข', name: 'ใครก็ไม่รู้', email: 'nut@x.co', password: PW }),
      ),
    ).rejects.toThrow(/มีบัญชีอยู่แล้ว/);
    expect(await countTenants(), 'ธุรกรรมต้องย้อนกลับทั้งก้อน').toBe(1);
  });

  it('รหัสผ่านสั้นเกินไปถูกปฏิเสธ', async () => {
    await expect(
      newTenant((tx, enter) =>
        signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'x@x.co', password: 'สั้น' }),
      ),
    ).rejects.toThrow(/อย่างน้อย 10 ตัว/);
  });
});

describe('ด่านตรวจสมาชิก — บั๊กที่เทสต์ระดับบริการจับไม่ได้', () => {
  it('ต้องถามในขอบเขตบัญชี ไม่งั้นเจ้าของที่ทำงานเองก็ถูกมองว่าไม่ใช่สมาชิก', async () => {
    const me = await newTenant((tx, enter) =>
      signup(tx, enter, { companyName: 'ก', name: 'ณัฐ', email: 'nut@x.co', password: PW }),
    );

    // แบบที่ผิด — ไม่ตั้ง app.user_id เลย RLS คืน 0 แถว
    const blind = await anon(async (tx) => {
      const r = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from memberships where user_id = ${me.userId}`,
      );
      return [...r][0]?.n ?? -1;
    });
    expect(blind, 'ยืนยันว่า RLS ปิดจริงเมื่อไม่ได้ตั้งขอบเขต').toBe(0);

    // แบบที่ถูก — ขอบเขตบัญชีเห็นแถวของตัวเอง
    const seen = await asAccount(me.userId, 'nut@x.co', async (tx) => {
      const r = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from memberships where user_id = ${me.userId}`,
      );
      return [...r][0]?.n ?? -1;
    });
    expect(seen, 'ขอบเขตบัญชีต้องเห็นแถวของตัวเอง').toBe(1);
  });
});
