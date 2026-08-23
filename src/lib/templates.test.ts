/**
 * เกณฑ์ผ่านของ M9
 *   สร้างจากแม่แบบ HR แล้วได้ 6 งานหลัก 21 การ์ด วันที่ถูกต้อง
 *   แก้แม่แบบแล้วโปรเจกต์เก่าไม่เปลี่ยน
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '@/db/client';
import { installCentralTemplates } from '@/db/install-central-templates';
import * as s from '@/db/schema';
import { createClient, createProject, getProject, listFeatures } from './projects';
import { listTasks } from './tasks';
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  templateFromProject,
  updateTemplate,
} from './templates';

const APP_URL = process.env.DATABASE_URL ?? 'postgres://app:devonly@127.0.0.1:5432/taronex';
const OWNER_URL =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

const appClient = postgres(APP_URL, { max: 1, onnotice: () => {} });
const appDb = drizzle(appClient, { schema: s });
const ownerClient = postgres(OWNER_URL, { max: 1, onnotice: () => {} });
const ownerDb = drizzle(ownerClient, { schema: s });

let tenantId = '';
let clientId = '';
let userId = '';

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
  await installCentralTemplates(ownerDb);

  const t = await ownerDb
    .insert(s.tenants)
    .values({ name: 'ทดสอบ M9', slug: 'm9testtenant' })
    .returning({ id: s.tenants.id });
  tenantId = t[0]?.id ?? '';
  const u = await ownerDb
    .insert(s.users)
    .values({ email: 'u@m9.co', name: 'ผู้ใช้', passwordHash: 'x' })
    .returning({ id: s.users.id });
  userId = u[0]?.id ?? '';

  const c = await asTenant((tx) => createClient(tx, tenantId, { name: 'ลูกค้า', code: 'X' }));
  clientId = c?.id ?? '';
});

afterAll(async () => {
  await appClient.end({ timeout: 5 });
  await ownerClient.end({ timeout: 5 });
});

const mkProject = (key: string, startsOn = '2026-01-01') =>
  asTenant((tx) =>
    createProject(tx, tenantId, {
      key,
      name: `โปรเจกต์ ${key}`,
      clientId,
      startsOn,
      dueOn: '2026-12-31',
    }),
  );

/** หา id ของแม่แบบ HR ก่อนแล้วค่อยเปิดธุรกรรม — await ในลูกศรที่ไม่ใช่ async ทำไม่ได้ */
async function withHr<T>(fn: (tx: Tx, id: string) => Promise<T>): Promise<T> {
  const id = await hrTemplateId();
  return asTenant((tx) => fn(tx, id));
}

async function hrTemplateId() {
  const list = await asTenant((tx) => listTemplates(tx, tenantId));
  const hr = list.find((t) => t.name.includes('HR'));
  if (!hr) throw new Error('ไม่พบแม่แบบ HR');
  return hr.id;
}

describe('เกณฑ์ 1 · สร้างจากแม่แบบ HR ได้ 6 งานหลัก 21 การ์ด', () => {
  it('จำนวนตรงตามที่เกณฑ์ระบุ', async () => {
    const p = await mkProject('HR');
    const r = await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));

    expect(r.features, 'เกณฑ์ระบุ 6 งานหลัก').toBe(6);
    expect(r.tasks, 'เกณฑ์ระบุ 21 การ์ด').toBe(21);

    const fs = await asTenant((tx) => listFeatures(tx, p?.id ?? ''));
    expect(fs).toHaveLength(6);
    const ts = await asTenant((tx) => listTasks(tx, p?.id ?? ''));
    expect(ts).toHaveLength(21);
  });

  it('วันที่แปลงจากวันสัมพัทธ์เป็นวันจริงถูกต้อง', async () => {
    const p = await mkProject('HR', '2026-03-01');
    await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));

    const ts = await asTenant((tx) => listTasks(tx, p?.id ?? ''));
    // การ์ดแรกของแม่แบบ HR: offset 0 duration 3 → เริ่มวันเริ่มโปรเจกต์
    const first = ts.find((t) => t.title === 'ออกแบบฐานข้อมูลพนักงาน');
    expect(first?.startDate).toBe('2026-03-01');
    expect(first?.dueDate).toBe('2026-03-04');

    // ทุกใบต้องมีวันที่ ไม่มีใบไหนหลุด
    expect(ts.every((t) => t.startDate && t.dueDate)).toBe(true);
  });

  it('การ์ดทุกใบลงคอลัมน์แรก และเลขไม่ซ้ำ', async () => {
    const p = await mkProject('HR');
    await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));
    const ts = await asTenant((tx) => listTasks(tx, p?.id ?? ''));

    expect(
      ts.every((t) => t.columnIndex === 0),
      'การ์ดจากแม่แบบลงคอลัมน์แรกเหมือนการ์ดที่คนสร้าง',
    ).toBe(true);
    expect(new Set(ts.map((t) => t.number)).size).toBe(21);
  });

  it('ตัวนับเลขการ์ดเดินต่อจากแม่แบบ — การ์ดใบถัดไปไม่เลขซ้ำ', async () => {
    const p = await mkProject('HR');
    await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));

    const { createTask } = await import('./tasks');
    const next = await asTenant((tx) =>
      createTask(tx, tenantId, p?.id ?? '', userId, { title: 'ใบถัดไป' }),
    );
    expect(next.number, 'ต้องเป็น 22 ไม่ใช่ 1').toBe(22);
  });

  it('ตั้ง baseline ทันที ไม่รอให้คนมากด', async () => {
    const p = await mkProject('HR');
    await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));
    const proj = await asTenant((tx) => getProject(tx, p?.id ?? ''));
    expect(proj.baselineTaskCount, 'ถ้ารอให้คนกด จะไม่มีใครกด แล้วตัวเลขบานปลายจะใช้ไม่ได้').toBe(21);
  });

  it('เฟสถูกสร้างและเฟสแรกเป็นเฟสปัจจุบัน', async () => {
    const p = await mkProject('HR');
    const r = await withHr((tx, id) => applyTemplate(tx, tenantId, p?.id ?? '', id, userId));
    expect(r.phases).toBe(4);
    const proj = await asTenant((tx) => getProject(tx, p?.id ?? ''));
    expect(proj.currentPhaseId).not.toBeNull();
    expect(proj.phases[0]?.name).toBe('วางระบบ');
  });
});

describe('เกณฑ์ 2 · แก้แม่แบบแล้วโปรเจกต์เก่าไม่เปลี่ยน', () => {
  it('โปรเจกต์คัดลอกค่าออกมา ไม่ได้อ้างอิงกลับไปที่แม่แบบ', async () => {
    const tpl = await asTenant((tx) =>
      createTemplate(tx, tenantId, {
        name: 'แม่แบบของทีม',
        definition: {
          board: [
            { key: 'todo', name: 'รอเริ่ม' },
            { key: 'done', name: 'เสร็จ' },
          ],
          typeLabels: { a: 'งาน' },
          phases: [{ name: 'ทำงาน' }],
          features: [
            { name: 'งานหลักเดิม', tasks: [{ title: 'การ์ดเดิม', offsetDays: 0, durationDays: 1 }] },
          ],
        },
      }),
    );

    const p = await mkProject('AAA');
    await asTenant((tx) => applyTemplate(tx, tenantId, p?.id ?? '', tpl?.id ?? '', userId));

    // แก้แม่แบบยกชุด
    await asTenant((tx) =>
      updateTemplate(tx, tenantId, tpl?.id ?? '', {
        name: 'ชื่อใหม่',
        definition: {
          board: [
            { key: 'a', name: 'คอลัมน์ใหม่ 1' },
            { key: 'b', name: 'คอลัมน์ใหม่ 2' },
          ],
          typeLabels: { a: 'เปลี่ยนแล้ว' },
          phases: [{ name: 'เฟสใหม่' }],
          features: [{ name: 'งานหลักใหม่', tasks: [] }],
        },
      }),
    );

    const proj = await asTenant((tx) => getProject(tx, p?.id ?? ''));
    const board = proj.board as { name: string }[];
    expect(board[0]?.name, 'บอร์ดของโปรเจกต์ต้องไม่เปลี่ยนตามแม่แบบ').toBe('รอเริ่ม');
    expect(proj.features[0]?.name).toBe('งานหลักเดิม');
    expect(proj.phases[0]?.name).toBe('ทำงาน');

    const ts = await asTenant((tx) => listTasks(tx, p?.id ?? ''));
    expect(ts[0]?.title).toBe('การ์ดเดิม');
  });

  it('ลบแม่แบบแล้วโปรเจกต์ที่สร้างไปแล้วยังอยู่ครบ', async () => {
    const tpl = await asTenant((tx) =>
      createTemplate(tx, tenantId, {
        name: 'แม่แบบที่จะลบ',
        definition: {
          board: [
            { key: 'a', name: 'หนึ่ง' },
            { key: 'b', name: 'สอง' },
          ],
          typeLabels: { a: 'งาน' },
          phases: [],
          features: [{ name: 'งานหลัก', tasks: [{ title: 'การ์ด' }] }],
        },
      }),
    );
    const p = await mkProject('BBB');
    await asTenant((tx) => applyTemplate(tx, tenantId, p?.id ?? '', tpl?.id ?? '', userId));
    await asTenant((tx) => deleteTemplate(tx, tenantId, tpl?.id ?? ''));

    const ts = await asTenant((tx) => listTasks(tx, p?.id ?? ''));
    expect(ts).toHaveLength(1);
  });
});

describe('แม่แบบกลาง', () => {
  it('มีครบ 8 ชุด และทุกที่ทำงานเห็น', async () => {
    const list = await asTenant((tx) => listTemplates(tx, tenantId));
    const central = list.filter((t) => t.isCentral);
    expect(central).toHaveLength(8);
  });

  it('แก้แม่แบบกลางไม่ได้', async () => {
    const id = await hrTemplateId();
    await expect(
      asTenant((tx) => updateTemplate(tx, tenantId, id, { name: 'แอบแก้' })),
    ).rejects.toThrow(/แม่แบบกลางแก้ไม่ได้/);
    await expect(asTenant((tx) => deleteTemplate(tx, tenantId, id))).rejects.toThrow();
  });

  it('ไม่นับตัวนับบนแม่แบบกลาง — เป็นการเขียนข้ามที่ทำงาน', async () => {
    const id = await hrTemplateId();
    const before = (await asTenant((tx) => getTemplate(tx, id))).useCount;
    const p = await mkProject('CCC');
    // ต้องสร้างโปรเจกต์จากแม่แบบกลางได้ โดยไม่ติด RLS
    const r = await withHr((tx, tid) => applyTemplate(tx, tenantId, p?.id ?? '', tid, userId));
    expect(r.tasks).toBe(21);
    const after = (await asTenant((tx) => getTemplate(tx, id))).useCount;
    expect(after, 'แม่แบบกลางเป็นแถวที่ทุกที่ทำงานใช้ร่วมกัน จึงไม่เขียนทับ').toBe(before);
  });

  it('แม่แบบของทีมนับตัวนับได้ตามปกติ', async () => {
    const tpl = await asTenant((tx) =>
      createTemplate(tx, tenantId, {
        name: 'ของทีม',
        definition: {
          board: [
            { key: 'a', name: 'หนึ่ง' },
            { key: 'b', name: 'สอง' },
          ],
          typeLabels: { a: 'งาน' },
          phases: [],
          features: [],
        },
      }),
    );
    const p = await mkProject('EEE');
    await asTenant((tx) => applyTemplate(tx, tenantId, p?.id ?? '', tpl?.id ?? '', userId));
    const got = await asTenant((tx) => getTemplate(tx, tpl?.id ?? ''));
    expect(got.useCount).toBe(1);
  });
});

describe('ถอดโปรเจกต์เป็นแม่แบบ', () => {
  it('ตัดชื่อคนและวันจริงออก เก็บเป็นวันสัมพัทธ์', async () => {
    const p = await mkProject('DDD', '2026-05-01');
    const { addFeature } = await import('./projects');
    const f = await asTenant((tx) => addFeature(tx, tenantId, p?.id ?? '', { name: 'งานหลัก' }));
    await asTenant(async (tx) => {
      await tx.insert(s.tasks).values({
        tenantId,
        projectId: p?.id ?? '',
        featureId: f?.id,
        number: 1,
        title: 'งานที่มีคนถือ',
        columnKey: 'todo',
        assigneeId: userId,
        startDate: '2026-05-11',
        dueDate: '2026-05-16',
      });
    });

    const tpl = await asTenant((tx) =>
      templateFromProject(tx, tenantId, p?.id ?? '', 'แม่แบบจากโปรเจกต์'),
    );
    const got = await asTenant((tx) => getTemplate(tx, tpl?.id ?? ''));
    const task = got.definition.features[0]?.tasks[0];

    expect(task?.offsetDays, 'วันเริ่ม 2026-05-11 ห่างจากวันเริ่มโปรเจกต์ 10 วัน').toBe(10);
    expect(task?.durationDays).toBe(5);
    // ไม่มีที่ไหนในแม่แบบที่เก็บชื่อคนหรือวันจริง
    const raw = JSON.stringify(got.definition);
    expect(raw).not.toContain(userId);
    expect(raw).not.toContain('2026-05-11');
  });
});
