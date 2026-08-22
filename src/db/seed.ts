/**
 * ข้อมูลตัวอย่าง — 2 ที่ทำงาน · 5 คน (หนึ่งคนอยู่ทั้งสองที่) · 4 ลูกค้า · 4 โปรเจกต์ · 40 การ์ด
 *
 * "หนึ่งคนอยู่ทั้งสองที่ทำงาน" สำคัญมาก — เป็นเคสที่ทำให้บั๊กเรื่องการแยกข้อมูลโผล่
 * ถ้าข้อมูลตัวอย่างมีแต่คนที่อยู่ที่เดียว จะไม่มีวันเจอว่า query ไหนลืมกรอง
 *
 * รันด้วย role เจ้าของตาราง เพราะต้องข้าม RLS ตอนใส่ข้อมูลตั้งต้น
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as s from './schema';

const url =
  process.env.DATABASE_MIGRATION_URL ?? 'postgres://postgres:devonly@127.0.0.1:5432/taronex';

/** ชุดคอลัมน์มาตรฐาน 4 คอลัมน์ — ชื่อเปลี่ยนได้ ลำดับคือสิ่งที่มีความหมาย */
const BOARD = [
  { key: 'todo', name: 'รอเริ่ม' },
  { key: 'doing', name: 'กำลังทำ' },
  { key: 'review', name: 'รอตรวจ' },
  { key: 'done', name: 'เสร็จ' },
];
const TYPES = { a: 'งาน', b: 'บั๊ก', c: 'เอกสาร' };

type SeedDb = ReturnType<typeof drizzle<typeof s>>;

/**
 * สร้างข้อมูลตัวอย่างใหม่ทั้งหมด — ล้างของเดิมก่อนเสมอ
 * เทสต์เรียกฟังก์ชันนี้ใน beforeAll เพื่อไม่ให้ทำงานบนข้อมูลที่รอบก่อนแก้ค้างไว้
 */
export async function seed(db: SeedDb, log: (m: string) => void = () => {}) {
  log('ล้างข้อมูลเดิม…');
  await db.execute(sql`
    TRUNCATE sla_clock_events, sla_clocks, sla_policy_levels, sla_policies,
             warranty_contracts, time_entries, attachments, comments, task_events, tasks,
             project_members, features, project_phases, projects, project_templates,
             portal_tokens, client_contacts, clients, invitations, memberships,
             sessions, notifications, users, tenants
    RESTART IDENTITY CASCADE
  `);

  // ── ที่ทำงาน ──
  const [dx, hb] = await db
    .insert(s.tenants)
    .values([
      { name: 'ดิจิทัลเอกซ์', slug: 'k7m2xq9prst4', status: 'active', plan: 'team' },
      { name: 'ฮับครีเอทีฟ', slug: 'w4n8vz3ycdb6', status: 'trial', plan: 'free' },
    ])
    .returning();
  if (!dx || !hb) throw new Error('สร้างที่ทำงานไม่สำเร็จ');

  // ── คน ──
  const people = await db
    .insert(s.users)
    .values([
      { email: 'nut@digitalx.co.th', name: 'ณัฐ วรกิจ' },
      { email: 'ploy@digitalx.co.th', name: 'พลอย ศรีสุข' },
      { email: 'top@digitalx.co.th', name: 'ต๊อป ชัยมงคล' },
      { email: 'mint@hubcreative.co.th', name: 'มิ้นท์ อารีย์' },
      // คนนี้อยู่ทั้งสองที่ทำงาน — เคสที่ทำให้บั๊กการแยกข้อมูลโผล่
      { email: 'earth@freelance.co.th', name: 'เอิร์ธ พงศ์ธร' },
    ])
    .returning();
  const [nut, ploy, top, mint, earth] = people;
  if (!nut || !ploy || !top || !mint || !earth) throw new Error('สร้างผู้ใช้ไม่สำเร็จ');

  await db.insert(s.memberships).values([
    { tenantId: dx.id, userId: nut.id, role: 'owner', jobTitle: 'pm' },
    { tenantId: dx.id, userId: ploy.id, role: 'member', jobTitle: 'dev' },
    { tenantId: dx.id, userId: top.id, role: 'member', jobTitle: 'qa' },
    { tenantId: dx.id, userId: earth.id, role: 'guest', jobTitle: 'design' },
    { tenantId: hb.id, userId: mint.id, role: 'owner', jobTitle: 'pm' },
    { tenantId: hb.id, userId: earth.id, role: 'member', jobTitle: 'design' },
  ]);

  // ── ลูกค้า ──
  const cs = await db
    .insert(s.clients)
    .values([
      { tenantId: dx.id, name: 'บริษัท แอคมี จำกัด', code: 'ACM' },
      { tenantId: dx.id, name: 'ทองไทย กรุ๊ป', code: 'TT' },
      { tenantId: hb.id, name: 'สยามฟู้ด', code: 'SF' },
      { tenantId: hb.id, name: 'บ้านสวนรีสอร์ท', code: 'BS' },
    ])
    .returning();
  const [acme, thong, siam, baan] = cs;
  if (!acme || !thong || !siam || !baan) throw new Error('สร้างลูกค้าไม่สำเร็จ');

  await db.insert(s.clientContacts).values([
    {
      tenantId: dx.id,
      clientId: thong.id,
      email: 'somchai@thongthai.co.th',
      name: 'สมชาย ผู้ประสานงาน',
      canReport: true,
      canSeeAll: true,
    },
    {
      tenantId: hb.id,
      clientId: siam.id,
      email: 'kanya@siamfood.co.th',
      name: 'กัญญา ฝ่ายการตลาด',
      canReport: true,
      canSeeAll: false,
    },
  ]);

  // ── โปรเจกต์ ──
  const ps = await db
    .insert(s.projects)
    .values([
      {
        tenantId: dx.id,
        clientId: acme.id,
        key: 'ACM',
        name: 'ระบบสั่งซื้อออนไลน์',
        pmUserId: nut.id,
        board: BOARD,
        typeLabels: TYPES,
        startsOn: '2569-01-15'.replace('2569', '2026'),
        dueOn: '2026-04-30',
        baselineTaskCount: 24,
        nextTaskNumber: 25,
      },
      {
        tenantId: dx.id,
        clientId: thong.id,
        key: 'WEB',
        name: 'เว็บองค์กร ทองไทย',
        pmUserId: nut.id,
        board: BOARD,
        typeLabels: TYPES,
        startsOn: '2025-10-01',
        dueOn: '2026-01-31',
        deliveredAt: new Date('2026-02-05'),
        portalEnabled: true,
        baselineTaskCount: 18,
        nextTaskNumber: 19,
      },
      {
        tenantId: hb.id,
        clientId: siam.id,
        key: 'MKT',
        name: 'แคมเปญเปิดตัวสินค้า',
        pmUserId: mint.id,
        board: BOARD,
        typeLabels: TYPES,
        startsOn: '2026-03-01',
        dueOn: '2026-05-15',
        nextTaskNumber: 9,
      },
      {
        tenantId: hb.id,
        clientId: baan.id,
        key: 'BSR',
        name: 'รีแบรนด์รีสอร์ท',
        pmUserId: mint.id,
        board: BOARD,
        typeLabels: TYPES,
        startsOn: '2026-02-01',
        dueOn: '2026-06-30',
        isArchived: true,
        nextTaskNumber: 5,
      },
    ])
    .returning();
  const [pAcm, pWeb, pMkt, pBsr] = ps;
  if (!pAcm || !pWeb || !pMkt || !pBsr) throw new Error('สร้างโปรเจกต์ไม่สำเร็จ');

  await db.insert(s.projectPhases).values([
    {
      tenantId: dx.id,
      projectId: pAcm.id,
      name: 'พัฒนา',
      kind: 'normal',
      position: 1,
      startedAt: new Date('2026-01-15'),
    },
    {
      tenantId: dx.id,
      projectId: pWeb.id,
      name: 'ประกัน',
      kind: 'warranty',
      position: 2,
      startedAt: new Date('2026-02-05'),
    },
    {
      tenantId: hb.id,
      projectId: pMkt.id,
      name: 'ผลิตงาน',
      kind: 'normal',
      position: 1,
      startedAt: new Date('2026-03-01'),
    },
    { tenantId: hb.id, projectId: pBsr.id, name: 'ออกแบบ', kind: 'normal', position: 1 },
  ]);

  const fs = await db
    .insert(s.features)
    .values([
      { tenantId: dx.id, projectId: pAcm.id, name: 'ตะกร้าและชำระเงิน', position: 1 },
      { tenantId: dx.id, projectId: pAcm.id, name: 'จัดการสินค้า', position: 2 },
      { tenantId: hb.id, projectId: pMkt.id, name: 'สื่อโซเชียล', position: 1 },
    ])
    .returning();
  const [fCart, fProd, fSocial] = fs;
  if (!fCart || !fProd || !fSocial) throw new Error('สร้างงานหลักไม่สำเร็จ');

  // ── การ์ด 40 ใบ ──
  const cols = BOARD.map((c) => c.key);
  const owners = [nut.id, ploy.id, top.id, null];
  const rows: (typeof s.tasks.$inferInsert)[] = [];

  for (let i = 0; i < 24; i++) {
    rows.push({
      tenantId: dx.id,
      projectId: pAcm.id,
      number: i + 1,
      title: `งานของ ACM ลำดับที่ ${i + 1}`,
      columnKey: cols[i % 4] as string,
      featureId: i % 3 === 0 ? fCart.id : i % 3 === 1 ? fProd.id : null,
      assigneeId: owners[i % 4] ?? null,
      priority: (['low', 'medium', 'high', 'critical'] as const)[i % 4],
      position: i,
    });
  }
  // โปรเจกต์ที่ส่งมอบแล้ว — มีงานประกันที่ลูกค้าแจ้ง
  for (let i = 0; i < 8; i++) {
    rows.push({
      tenantId: dx.id,
      projectId: pWeb.id,
      number: i + 1,
      title: `เรื่องที่ลูกค้าแจ้ง ลำดับที่ ${i + 1}`,
      columnKey: cols[i % 4] as string,
      origin: 'warranty',
      warrantyScope: i === 0 ? 'pending' : i % 3 === 0 ? 'covered' : 'billable',
      isClientVisible: true,
      // ใบแรกยังไม่มีใครกดรับเรื่อง — ลูกค้าเห็น "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
      portalStage: i === 0 ? null : 'investigating',
      portalStageAt: i === 0 ? null : new Date('2026-02-10'),
      portalStageBy: i === 0 ? null : nut.id,
      assigneeId: i === 0 ? null : nut.id,
      reportedImpact: (['blocking', 'degraded', 'minor'] as const)[i % 3],
      position: i,
    });
  }
  for (let i = 0; i < 8; i++) {
    rows.push({
      tenantId: hb.id,
      projectId: pMkt.id,
      number: i + 1,
      title: `งานของ MKT ลำดับที่ ${i + 1}`,
      columnKey: cols[i % 4] as string,
      featureId: i % 2 === 0 ? fSocial.id : null,
      assigneeId: i % 2 === 0 ? mint.id : earth.id,
      position: i,
    });
  }
  const created = await db
    .insert(s.tasks)
    .values(rows)
    .returning({ id: s.tasks.id, tenantId: s.tasks.tenantId });

  // ประวัติหนึ่งแถวต่อการ์ด — บันทึกชื่อและตำแหน่งคอลัมน์ ณ ตอนสร้างไว้ด้วย
  await db.insert(s.taskEvents).values(
    created.map((t) => ({
      tenantId: t.tenantId,
      taskId: t.id,
      toColumnKey: 'todo',
      toColumnName: 'รอเริ่ม',
      toColumnIndex: 0,
      columnCount: BOARD.length,
      actorId: nut.id,
    })),
  );

  log(
    `เสร็จ · ที่ทำงาน 2 · คน ${people.length} · ลูกค้า ${cs.length} · โปรเจกต์ ${ps.length} · การ์ด ${created.length}`,
  );
  return { tenants: { dx, hb }, users: { nut, ploy, top, mint, earth } };
}

/** รันจากบรรทัดคำสั่ง: pnpm db:seed */
async function main() {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema: s });
  try {
    const out = await seed(db, (m) => console.log(m));
    console.log(`  ดิจิทัลเอกซ์ = ${out.tenants.dx.slug}`);
    console.log(`  ฮับครีเอทีฟ  = ${out.tenants.hb.slug}`);
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith('seed.ts')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
