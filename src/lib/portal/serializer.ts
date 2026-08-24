/**
 * ⭐ serializer ของพอร์ทัล — จุดเดียวที่ตัดสินว่าลูกค้าเห็นอะไร (กฎข้อ 6)
 *
 * ═══ ห้ามส่งออกไปเด็ดขาด ═══
 * `assignee` · `priority` ที่ทีมตั้ง · ตัวเลข SLA ทุกชนิด · เวลาที่มีชั่วโมงนาที ·
 * คอมเมนต์ภายใน · ชื่อคอลัมน์บนบอร์ด · `warranty_scope` ดิบ
 *
 * ═══ ทำไมมีไฟล์เดียว ═══
 * `GET /tasks/:id/client-view` (ฝั่งทีม) เรียกฟังก์ชันในไฟล์นี้ตัวเดียวกับที่พอร์ทัลเรียก
 * ถ้าเขียนสองตัว วันหนึ่งจะต่างกัน แล้วหน้า "ดูอย่างที่ลูกค้าเห็น" จะโกหก
 * ซึ่งอันตรายกว่าไม่มีหน้านั้นเลย เพราะทีมจะเชื่อมันแล้วเผลอเขียนอะไรที่ลูกค้าไม่ควรเห็น
 *
 * ═══ วันที่ไม่มีเวลา ═══
 * ส่งออกเป็น `YYYY-MM-DD` เท่านั้น ไม่มีชั่วโมงนาที
 * เวลาระดับนาทีทำให้พอร์ทัลกลายเป็นเครื่องมือจับผิดว่าทีมตอบช้าไปกี่นาที
 */

import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { projects, taskEvents, tasks } from '@/db/schema';

/** 5 ขั้นตามต้นแบบ · ตัดสิน 20 ส.ค. 2569 */
export const PORTAL_STAGES = [
  { key: 'received', label: 'รับเรื่องแล้ว' },
  { key: 'investigating', label: 'กำลังตรวจสอบ' },
  { key: 'fixing', label: 'กำลังแก้ไข' },
  { key: 'verifying', label: 'รอตรวจสอบผล' },
  { key: 'resolved', label: 'แก้ไขแล้ว' },
] as const;

export type PortalStageKey = (typeof PORTAL_STAGES)[number]['key'];

/**
 * ข้อความเมื่อยังไม่มีเจ้าหน้าที่กดรับเรื่อง
 * `portal_stage` ว่าง = ยังไม่มีใครกด — **ไม่แปลงจากคอลัมน์บนบอร์ดให้อัตโนมัติ**
 * (ตัดสิน 20 ส.ค. 2569 — ต้องได้รับการกดจากคนที่มีหน้าที่ก่อนเท่านั้น)
 */
export const NOT_YET_RECEIVED = 'ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง';

export interface PortalIssueRow {
  code: string;
  title: string;
  /** ป้ายที่ลูกค้าอ่าน — ไม่ใช่ชื่อคอลัมน์ของทีม */
  stageLabel: string;
  stage: PortalStageKey | null;
  isResolved: boolean;
  reportedOn: string;
}

export interface PortalIssueDetail extends PortalIssueRow {
  description: string | null;
  /** ระดับที่ลูกค้าเลือกเอง — ไม่ใช่ priority ที่ทีมตั้ง */
  reportedImpact: string | null;
  /** ทีมกดเองทั้งหมด · ขั้นที่ยังไม่ถึงคืน date = null */
  timeline: { key: PortalStageKey; label: string; date: string | null; note: string | null }[];
  /** ผลคัดแยกที่บอกลูกค้าได้ — ไม่ส่งค่าดิบ ส่งเป็นข้อความ */
  scopeNote: string | null;
}

/** ตัดเวลาออกให้เหลือแค่วัน — เรียกตรงนี้ที่เดียว จะได้ไม่มีที่ไหนหลุด */
function dateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

const SCOPE_TEXT: Record<string, string> = {
  covered: 'อยู่ในความรับผิดชอบตามสัญญาประกัน',
  billable: 'เป็นงานนอกขอบเขตเดิม ทีมงานจะติดต่อเรื่องใบเสนอราคา',
  not_ours: 'เกิดจากระบบอื่นหรือผู้ให้บริการภายนอก',
};

function labelOf(stage: string | null): string {
  if (!stage) return NOT_YET_RECEIVED;
  return PORTAL_STAGES.find((s) => s.key === stage)?.label ?? NOT_YET_RECEIVED;
}

/**
 * รายการเรื่องของผู้ติดต่อคนนี้
 *
 * `canSeeAll` = เห็นทุกเรื่องของบริษัทตัวเอง · ปกติเห็นเฉพาะที่ตัวเองแจ้ง
 * กรองด้วย `contact_id` ที่ผูกกับการ์ด ไม่ใช่ด้วยอีเมล
 */
export async function listPortalIssues(
  tx: Tx,
  opts: { clientId: string; contactId: string; canSeeAll: boolean },
): Promise<{ open: PortalIssueRow[]; closed: PortalIssueRow[] }> {
  const where = [eq(projects.clientId, opts.clientId), eq(projects.portalEnabled, true)];
  if (!opts.canSeeAll) where.push(eq(tasks.contactId, opts.contactId));

  const rows = await tx
    .select({
      number: tasks.number,
      projectKey: projects.key,
      title: tasks.title,
      stage: tasks.portalStage,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(...where, eq(tasks.origin, 'warranty')))
    .orderBy(asc(tasks.createdAt));

  const open: PortalIssueRow[] = [];
  const closed: PortalIssueRow[] = [];
  for (const r of rows) {
    const item: PortalIssueRow = {
      code: `${r.projectKey}-${r.number}`,
      title: r.title,
      stage: (r.stage as PortalStageKey | null) ?? null,
      stageLabel: labelOf(r.stage),
      isResolved: r.stage === 'resolved',
      reportedOn: dateOnly(r.createdAt) ?? '',
    };
    if (item.isResolved) closed.push(item);
    else open.push(item);
  }
  return { open, closed };
}

/**
 * รายละเอียดเรื่องเดียว — ใช้ทั้งฝั่งพอร์ทัลและหน้า "ดูอย่างที่ลูกค้าเห็น"
 *
 * ไทม์ไลน์อ่านจาก `task_events` ที่มี `to_portal_stage` เท่านั้น
 * ไม่แปลงจากการย้ายคอลัมน์ เพราะทุกขั้นต้องมีคนกดจริง (ตัดสิน 20 ส.ค. 2569)
 */
export async function portalIssueDetail(tx: Tx, taskId: string): Promise<PortalIssueDetail | null> {
  const rows = await tx
    .select({
      id: tasks.id,
      number: tasks.number,
      projectKey: projects.key,
      title: tasks.title,
      description: tasks.description,
      reportedImpact: tasks.reportedImpact,
      stage: tasks.portalStage,
      warrantyScope: tasks.warrantyScope,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(tasks.id, taskId))
    .limit(1);
  const t = rows[0];
  if (!t) return null;

  const events = await tx
    .select({
      stage: taskEvents.toPortalStage,
      at: taskEvents.at,
      reason: taskEvents.reason,
    })
    .from(taskEvents)
    .where(
      and(
        eq(taskEvents.taskId, taskId),
        inArray(taskEvents.toPortalStage, [
          'received',
          'investigating',
          'fixing',
          'verifying',
          'resolved',
        ]),
      ),
    )
    .orderBy(asc(taskEvents.at));

  // ขั้นเดิมที่ถูกกดซ้ำ ให้ยึดครั้งแรก — ลูกค้าสนใจว่า "ถึงขั้นนี้เมื่อไร"
  const firstAt = new Map<string, { at: Date; note: string | null }>();
  for (const e of events) {
    if (e.stage && !firstAt.has(e.stage)) firstAt.set(e.stage, { at: e.at, note: e.reason });
  }

  return {
    code: `${t.projectKey}-${t.number}`,
    title: t.title,
    description: t.description,
    reportedImpact: t.reportedImpact,
    stage: (t.stage as PortalStageKey | null) ?? null,
    stageLabel: labelOf(t.stage),
    isResolved: t.stage === 'resolved',
    reportedOn: dateOnly(t.createdAt) ?? '',
    timeline: PORTAL_STAGES.map((s) => {
      const hit = firstAt.get(s.key);
      return {
        key: s.key,
        label: s.label,
        date: dateOnly(hit?.at ?? null),
        note: hit?.note ?? null,
      };
    }),
    scopeNote: t.warrantyScope ? (SCOPE_TEXT[t.warrantyScope] ?? null) : null,
  };
}

/** หาการ์ดจากรหัส (TT-026) ภายในขอบเขตของผู้ติดต่อคนนี้ */
export async function findIssueByCode(
  tx: Tx,
  opts: { clientId: string; contactId: string; canSeeAll: boolean; code: string },
): Promise<string | null> {
  const [projectKey, numStr] = opts.code.split('-');
  const num = Number.parseInt(numStr ?? '', 10);
  if (!projectKey || !Number.isFinite(num)) return null;

  const where = [
    eq(projects.key, projectKey.toUpperCase()),
    eq(projects.clientId, opts.clientId),
    eq(projects.portalEnabled, true),
    eq(tasks.number, num),
    eq(tasks.origin, 'warranty'),
  ];
  if (!opts.canSeeAll) where.push(eq(tasks.contactId, opts.contactId));

  const rows = await tx
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(...where))
    .limit(1);
  return rows[0]?.id ?? null;
}
