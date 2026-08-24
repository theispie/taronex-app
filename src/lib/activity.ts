/**
 * หน้ากิจกรรม — M11ข
 *
 * ═══ กฎข้อ 9 คือทั้งหมดของไฟล์นี้ ═══
 * "ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ และห้ามมีตัวเลขที่ PM เห็นแต่คนอื่นไม่เห็น"
 *
 * `49.md` เขียนไว้เองว่า "ทันทีที่ PM เห็นตัวเลขที่คนอื่นไม่เห็น หน้านี้จะกลายเป็นเครื่องมือประเมินผล"
 * และ `46.md` ว่า "ถ้ามีตัวเลขเรียงลำดับคนเมื่อไหร่ เดฟจะเริ่มลากการ์ดถี่ๆ ให้ดูขยัน"
 *
 * ═══ การตัดสินใจที่สำคัญที่สุดในไฟล์นี้ ═══
 * **จำนวนดิบไม่เคยออกจากฟังก์ชันนี้เลย** ตัดเป็นระดับความเข้ม 0–3 ก่อนคืนค่าเสมอ
 * ถ้าคืนจำนวนออกไปแล้วให้หน้าเว็บตัดเอง วันหนึ่งจะมีคนเปิด DevTools แล้วเห็นตัวเลข
 * หรือมีใครเขียนหน้าใหม่ที่เอาไปแสดงตรงๆ — พอตัดที่นี่ ตัวเลขนั้นไม่มีอยู่ให้ใช้ตั้งแต่แรก
 *
 * ข้อจำกัดที่ยอมรับตรงๆ: ระดับ 0–3 ก็ยังพอเรียงลำดับหยาบๆ ได้
 * แต่มันหยาบพอที่จะไม่มีใครเอาไปทำ KPI และตรงกับที่ต้นแบบตั้งใจไว้
 * ("ความเข้ม 4 ระดับ ไม่มีตัวเลขกำกับ") ถ้าจะเข้มกว่านี้คือตัดหน้านี้ทิ้งทั้งหน้า
 *
 * ═══ ไม่มีตารางใหม่ ═══
 * ทุกอย่างอ่านจาก `task_events` + `comments` ที่บันทึกอยู่แล้ว ไม่มีใครต้องกรอกอะไรเพิ่ม
 */

import { sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';

export type Range = 'day' | 'week' | 'month';
export type GroupBy = 'person' | 'project';

/** 0 = ไม่มีความเคลื่อนไหว · 1–3 = เข้มขึ้นตามลำดับ */
export type Heat = 0 | 1 | 2 | 3;

/**
 * ตัดจำนวนเป็นระดับ — ขอบเขตตายตัว ไม่ใช่เปอร์เซ็นไทล์
 *
 * ใช้ค่าคงที่เพราะถ้าตัดตามค่าสูงสุดของกลุ่ม ระดับของคนหนึ่งจะเปลี่ยน
 * เมื่อคนอื่นทำงานมากขึ้น ซึ่งเป็นการเทียบคนโดยตรง — ตรงข้ามกับเจตนาของกฎข้อ 9
 */
function heatOf(n: number): Heat {
  if (n <= 0) return 0;
  if (n <= 2) return 1;
  if (n <= 6) return 2;
  return 3;
}

export interface DayEvent {
  at: string;
  actorId: string | null;
  actorName: string | null;
  code: string;
  text: string;
}

export interface HeatRow {
  key: string;
  name: string;
  /** ยาวเท่ากับจำนวนช่องของช่วงที่ขอ */
  cells: Heat[];
  /**
   * การ์ดที่คนนี้ถืออยู่ตอนนี้ — คืนเป็น**รหัสการ์ด ไม่ใช่จำนวน**
   *
   * `46.md` บอกว่าแถวที่ไม่มีความเคลื่อนไหวต้องแสดงว่าเขาถือการ์ดอะไรอยู่ควบคู่เสมอ
   * เพราะ "ไม่มีความเคลื่อนไหว" ไม่เท่ากับ "ไม่ได้ทำอะไร" — อาจติดอยู่กับการ์ดใบเดียวทั้งสัปดาห์
   * ส่งรหัสแทนจำนวนเพราะจำนวนเอาไปเรียงลำดับคนได้ ส่วนรหัสเอาไปเปิดดูได้ว่าติดอะไรอยู่
   */
  holding: string[];
}

export interface ActivityResult {
  range: Range;
  group: GroupBy;
  /** วันแรกของช่วง (YYYY-MM-DD) */
  from: string;
  to: string;
  labels: string[];
  /** มีเฉพาะ range=day */
  events: DayEvent[];
  /** มีเฉพาะ range=week|month */
  rows: HeatRow[];
  /** ภาพรวมทั้งที่ทำงาน — ไม่ผูกกับคน ใช้ดูว่าช่วงไหนงานเดิน */
  overall: Heat[];
  /**
   * บริบทของวันนั้นทั้งที่ทำงาน — "แตะ 3 การ์ด · 2 โปรเจกต์"
   * เป็นตัวเลขระดับ*ที่ทำงาน* ไม่ใช่ระดับคน จึงเอาไปเรียงลำดับใครไม่ได้
   * (`46.md` อนุญาตไว้ตรงๆ ว่าใช้เป็นบริบทได้)
   */
  touchedTasks: number;
  touchedProjects: number;
}

const DAY_MS = 86_400_000;
const WEEKDAY_LABELS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ช่วงเวลาที่ขอ · สัปดาห์เริ่มวันจันทร์ตามที่คนไทยใช้กัน */
function windowOf(range: Range, dateStr?: string) {
  const anchor = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const base = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
  );

  if (range === 'day') {
    return { from: base, to: new Date(base.getTime() + DAY_MS), slots: 1, labels: [iso(base)] };
  }
  if (range === 'week') {
    const dow = (base.getUTCDay() + 6) % 7; // จันทร์ = 0
    const from = new Date(base.getTime() - dow * DAY_MS);
    return {
      from,
      to: new Date(from.getTime() + 7 * DAY_MS),
      slots: 7,
      labels: WEEKDAY_LABELS,
    };
  }
  const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const to = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  return { from, to, slots: days, labels: Array.from({ length: days }, (_, i) => String(i + 1)) };
}

/**
 * กิจกรรมของช่วงที่ขอ
 *
 * ขอบเขตข้อมูลมาจาก RLS + รายการโปรเจกต์ที่ผู้ใช้คนนี้เห็น (ส่งเข้ามาทาง `projectIds`)
 * **ทุกบทบาทเรียกฟังก์ชันเดียวกัน** ต่างแค่ขอบเขตที่กรองให้ — ไม่มีตัวเลขลับสำหรับ PM
 */
export async function activity(
  tx: Tx,
  opts: { range: Range; group: GroupBy; date?: string; projectIds: string[] },
): Promise<ActivityResult> {
  const w = windowOf(opts.range, opts.date);
  const empty: ActivityResult = {
    range: opts.range,
    group: opts.group,
    from: iso(w.from),
    to: iso(new Date(w.to.getTime() - DAY_MS)),
    labels: w.labels,
    events: [],
    rows: [],
    overall: Array.from({ length: w.slots }, () => 0 as Heat),
    touchedTasks: 0,
    touchedProjects: 0,
  };
  if (opts.projectIds.length === 0) return empty;

  const ids = sql.join(
    opts.projectIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const fromTs = w.from.toISOString();
  const toTs = w.to.toISOString();

  /**
   * เหตุการณ์ทั้งหมดในช่วง — รวม task_events กับ comments เป็นชุดเดียว
   * เขียนเป็น SQL ตรงเพราะต้อง UNION สองตาราง ซึ่ง query builder ทำได้ไม่สวยกว่า
   */
  const rows = await tx.execute<{
    at: Date;
    actor_id: string | null;
    actor_name: string | null;
    project_id: string;
    code: string;
    kind: string;
    detail: string | null;
  }>(sql`
    with ev as (
      select e.at, e.actor_id, e.task_id, t.project_id,
             p.key || '-' || t.number as code,
             case
               when e.to_portal_stage is not null then 'portal'
               when e.to_column_index is not null and e.from_column_index is null then 'create'
               when e.to_column_index < e.from_column_index then 'bounce'
               when e.to_column_index is not null then 'move'
               else 'other'
             end as kind,
             coalesce(e.to_column_name, e.reason) as detail
        from task_events e
        join tasks t on t.id = e.task_id
        join projects p on p.id = t.project_id
       where e.at >= ${fromTs} and e.at < ${toTs}
         and t.project_id in (${ids})
      union all
      select c.created_at as at, c.author_id as actor_id, c.task_id, t.project_id,
             p.key || '-' || t.number as code,
             case when c.is_system then 'system' else 'comment' end as kind,
             null as detail
        from comments c
        join tasks t on t.id = c.task_id
        join projects p on p.id = t.project_id
       where c.created_at >= ${fromTs} and c.created_at < ${toTs}
         and t.project_id in (${ids})
    )
    select ev.at, ev.actor_id, u.name as actor_name, ev.project_id, ev.code, ev.kind, ev.detail
      from ev
      left join users u on u.id = ev.actor_id
     order by ev.at asc
  `);
  const all = [...rows];

  // ── รายวัน: เส้นเวลาล้วน ไม่มีการนับอะไรทั้งสิ้น ──
  if (opts.range === 'day') {
    return {
      ...empty,
      events: all.map((r) => ({
        at: new Date(r.at).toISOString(),
        actorId: r.actor_id,
        actorName: r.actor_name,
        code: r.code,
        text: describe(r.kind, r.code, r.detail),
      })),
      overall: [heatOf(all.length)],
      touchedTasks: new Set(all.map((r) => r.code)).size,
      touchedProjects: new Set(all.map((r) => r.project_id)).size,
    };
  }

  // ── รายสัปดาห์/รายเดือน: ตัดเป็นระดับความเข้มก่อนคืนค่า ──
  const names = new Map<string, string>();
  const counts = new Map<string, number[]>();
  const overall = Array.from({ length: w.slots }, () => 0);

  const projectNames = await tx.execute<{ id: string; name: string }>(sql`
    select id, name from projects where id in (${ids})
  `);
  for (const p of projectNames) names.set(p.id, p.name);

  for (const r of all) {
    const slot = Math.floor((new Date(r.at).getTime() - w.from.getTime()) / DAY_MS);
    if (slot < 0 || slot >= w.slots) continue;
    overall[slot] = (overall[slot] ?? 0) + 1;

    const key = opts.group === 'project' ? r.project_id : (r.actor_id ?? '');
    // เหตุการณ์ที่ลูกค้าเป็นคนทำไม่มี actor_id — ไม่นับเข้าแถวของใคร
    if (!key) continue;
    if (opts.group === 'person' && r.actor_name) names.set(key, r.actor_name);

    let cells = counts.get(key);
    if (!cells) {
      cells = Array.from({ length: w.slots }, () => 0);
      counts.set(key, cells);
    }
    cells[slot] = (cells[slot] ?? 0) + 1;
  }

  /**
   * เติมแถวของคนที่ "ไม่มีความเคลื่อนไหว" ให้ครบทุกคนในทีม
   * ถ้าแสดงเฉพาะคนที่มีเหตุการณ์ หน้านี้จะกลายเป็นรายชื่อคนขยัน ซึ่งแย่กว่าเดิม
   * `46.md`: ใช้คำว่า "ไม่มีความเคลื่อนไหว" ไม่ใช่ "ไม่มีผลงาน" — คำหลังตัดสินคน
   */
  const holding = new Map<string, string[]>();
  if (opts.group === 'person') {
    const members = await tx.execute<{ id: string; name: string }>(sql`
      select u.id, u.name
        from memberships m
        join users u on u.id = m.user_id
       where m.deactivated_at is null and u.is_active = true
    `);
    for (const m of members) {
      names.set(m.id, m.name);
      if (!counts.has(m.id))
        counts.set(
          m.id,
          Array.from({ length: w.slots }, () => 0),
        );
    }

    const held = await tx.execute<{ assignee_id: string; code: string }>(sql`
      select t.assignee_id, p.key || '-' || t.number as code
        from tasks t
        join projects p on p.id = t.project_id
       where t.assignee_id is not null
         and t.completed_at is null
         and t.project_id in (${ids})
       order by code
    `);
    for (const h of held) {
      const list = holding.get(h.assignee_id);
      if (list) list.push(h.code);
      else holding.set(h.assignee_id, [h.code]);
    }
  }

  return {
    ...empty,
    rows: [...counts.entries()]
      .map(([key, cells]) => ({
        key,
        name: names.get(key) ?? '—',
        cells: cells.map(heatOf),
        holding: holding.get(key) ?? [],
      }))
      // เรียงตามชื่อ **ไม่ใช่ตามปริมาณ** — เรียงตามปริมาณคือการจัดอันดับคน
      .sort((a, b) => a.name.localeCompare(b.name, 'th')),
    overall: overall.map(heatOf),
    touchedTasks: new Set(all.map((r) => r.code)).size,
    touchedProjects: new Set(all.map((r) => r.project_id)).size,
  };
}

/** ข้อความอ่านได้ของเหตุการณ์หนึ่งแถว */
function describe(kind: string, code: string, detail: string | null): string {
  switch (kind) {
    case 'create':
      return `สร้าง ${code}`;
    case 'move':
      return detail ? `ย้าย ${code} ไป ${detail}` : `ย้าย ${code}`;
    case 'bounce':
      return `ตีกลับ ${code}${detail ? ` — ${detail}` : ''}`;
    case 'portal':
      return `อัปเดตสถานะที่ลูกค้าเห็นของ ${code}`;
    case 'comment':
      return `บันทึกความคืบหน้าใน ${code}`;
    case 'system':
      return `ระบบบันทึกใน ${code}`;
    default:
      return `แตะ ${code}`;
  }
}
