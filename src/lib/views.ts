/**
 * มุมมองรวมของ M8 — หน้าแรก · งานที่ได้รับ · ปฏิทิน · ค้นหา · ภาพรวมทีม
 *
 * ═══ กฎข้อ 9 คือแกนของไฟล์นี้ ═══
 * ห้ามมีตัวเลขที่เอามาเรียงลำดับคนได้ และห้ามมีตัวเลขที่ PM เห็นแต่คนอื่นไม่เห็น
 *
 * ตัวเลขที่มีในนี้ทั้งหมดเป็น "ภาระตอนนี้" ไม่ใช่ "ผลงานสะสม"
 * จึงไม่มี "ปิดไปกี่ใบ" · ไม่มี "เร็วแค่ไหน" · ไม่มีอะไรที่เอามาเทียบคนได้
 * เอกสารเขียนเหตุผลไว้ตรงๆ ว่า ถ้ามีเมื่อไหร่ เดฟจะเริ่มลากการ์ดถี่ๆ ให้ดูขยัน
 */

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { memberships, notifications, projects, users } from '@/db/schema';

export interface TaskCard {
  id: string;
  code: string;
  title: string;
  projectKey: string;
  projectName: string;
  columnName: string;
  columnIndex: number;
  columnCount: number;
  isClosed: boolean;
  priority: string;
  featureName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  eta: string | null;
  heldDays: number;
  origin: string;
}

/**
 * ดึงการ์ดข้ามทุกโปรเจกต์ในที่ทำงานนี้ พร้อมค่าที่คำนวณสด
 *
 * "ถือมากี่วัน" = NOW() − เวลาที่เข้าคอลัมน์ปัจจุบันครั้งล่าสุด (จาก task_events)
 * ไม่เก็บเป็นคอลัมน์เพราะมันเปลี่ยนทุกวันโดยไม่มีใครแตะการ์ด
 */
async function cards(tx: Tx, where: string, params: unknown[] = []): Promise<TaskCard[]> {
  void params;
  const rows = await tx.execute<{
    id: string;
    code: string;
    title: string;
    project_key: string;
    project_name: string;
    column_name: string;
    column_index: number;
    column_count: number;
    is_closed: boolean;
    priority: string;
    feature_name: string | null;
    assignee_id: string | null;
    assignee_name: string | null;
    due_date: string | null;
    eta: string | null;
    held_days: number;
    origin: string;
  }>(sql`
    select t.id,
           p.key || '-' || t.number as code,
           t.title,
           p.key  as project_key,
           p.name as project_name,
           coalesce(col.name, t.column_key) as column_name,
           coalesce(col.idx, 0)::int as column_index,
           jsonb_array_length(p.board)::int as column_count,
           (coalesce(col.idx, 0) = jsonb_array_length(p.board) - 1) as is_closed,
           t.priority::text,
           f.name as feature_name,
           t.assignee_id,
           u.name as assignee_name,
           t.due_date::text,
           t.eta::text,
           greatest(0, floor(extract(epoch from (now() - coalesce(
             (select max(e.at) from task_events e
               where e.task_id = t.id and e.to_column_key = t.column_key),
             t.created_at))) / 86400))::int as held_days,
           t.origin::text
    from tasks t
    join projects p on p.id = t.project_id
    left join features f on f.id = t.feature_id
    left join users u on u.id = t.assignee_id
    left join lateral (
      select b->>'name' as name, ord - 1 as idx
      from jsonb_array_elements(p.board) with ordinality as x(b, ord)
      where b->>'key' = t.column_key limit 1
    ) col on true
    where p.is_archived = false and ${sql.raw(where)}
    order by t.due_date nulls last, t.position
  `);

  return [...rows].map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    projectKey: r.project_key,
    projectName: r.project_name,
    columnName: r.column_name,
    columnIndex: r.column_index,
    columnCount: r.column_count,
    isClosed: r.is_closed,
    priority: r.priority,
    featureName: r.feature_name,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    dueDate: r.due_date,
    eta: r.eta,
    heldDays: r.held_days,
    origin: r.origin,
  }));
}

// ─────────────────────────── ค้นหา ───────────────────────────

/**
 * ค้นข้ามทุกโปรเจกต์
 *
 * ═══ ทำไมไม่ใช้ full-text search ของ Postgres ═══
 * ภาษาไทยไม่มีเว้นวรรคระหว่างคำ ตัวตัดคำของ Postgres จึงมองทั้งประโยคเป็นคำเดียว
 * ค้น "อนุมัติ" ในประโยค "รอหัวหน้าอนุมัติก่อนส่ง" จะไม่เจอเลย
 * ต้องลงพจนานุกรมไทย (เช่น pg_thai) ซึ่งเพิ่มของที่ต้องดูแลบนเครื่อง 1 GB
 *
 * ใช้ ILIKE '%คำ%' แทน — ช้ากว่าแต่หาเจอจริงกับภาษาไทย
 * ที่ทำงานขนาด 5–50 คนมีการ์ดหลักพันถึงหมื่นใบ ซึ่ง ILIKE ยังเร็วพอ
 * ถ้าวันหนึ่งช้า ให้เพิ่ม pg_trgm + GIN index ก่อนคิดเรื่องพจนานุกรม
 */
export async function search(
  tx: Tx,
  q: string,
): Promise<{
  tasks: TaskCard[];
  matchedByCode: boolean;
}> {
  const term = q.trim();
  if (!term) return { tasks: [], matchedByCode: false };

  // รหัสการ์ด (ACM-138) — คนเอาไปอ้างกันในไลน์กับสแตนด์อัพ ต้องค้นเจอตรงๆ
  const asCode = /^([A-Za-z][A-Za-z0-9]{1,4})-(\d+)$/.exec(term);
  if (asCode) {
    const key = asCode[1]?.toUpperCase() ?? '';
    const num = Number(asCode[2]);
    const found = await cards(tx, `p.key = '${key.replace(/'/g, "''")}' and t.number = ${num}`);
    if (found.length > 0) return { tasks: found, matchedByCode: true };
  }

  const safe = term.replace(/'/g, "''").replace(/[%_\\]/g, (m) => `\\${m}`);
  const rows = await cards(
    tx,
    `(t.title ilike '%${safe}%' escape '\\'
      or t.description ilike '%${safe}%' escape '\\'
      or p.name ilike '%${safe}%' escape '\\'
      or p.key ilike '%${safe}%' escape '\\')`,
  );
  return { tasks: rows, matchedByCode: false };
}

// ─────────────────────────── ภาพรวมทีม ───────────────────────────

export interface TeamMemberNow {
  userId: string;
  name: string;
  jobTitle: string;
  /** ภาระตอนนี้ ไม่ใช่ผลงานสะสม — เอาไปเรียงลำดับคนไม่ได้ (กฎข้อ 9) */
  holding: number;
  cards: TaskCard[];
  /** ป้ายบอกอาการ ไม่ใช่คะแนน */
  flags: string[];
}

/**
 * โหมด "ตอนนี้" — ใครถืออะไรอยู่
 *
 * ตัวเลขที่แสดงมีแค่ "ถืออยู่กี่ใบ" กับ "ถือมากี่วัน" ซึ่งเป็นอาการ ไม่ใช่คะแนน
 * **ไม่มี "ปิดไปกี่ใบ" และจะไม่มี** — นั่นคือตัวเลขที่เอามาเรียงลำดับคนได้ทันที
 *
 * ธงทั้งหมดคำนวณสด ไม่เก็บ และทุกคนเห็นเหมือนกันหมด ไม่มีตัวเลขลับสำหรับ PM
 */
export async function teamNow(tx: Tx): Promise<TeamMemberNow[]> {
  const people = await tx
    .select({
      userId: users.id,
      name: users.name,
      jobTitle: memberships.jobTitle,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(isNull(memberships.deactivatedAt))
    .orderBy(asc(users.name));

  // การ์ดที่ยังไม่ปิดทั้งหมด แล้วค่อยแจกให้แต่ละคน — ไม่ยิงทีละคน
  const open = (await cards(tx, 't.assignee_id is not null')).filter((c) => !c.isClosed);

  return people.map((p) => {
    const mine = open.filter((c) => c.assigneeId === p.userId);
    const flags: string[] = [];

    // ถ้อยคำยกจากต้นแบบ ห้ามแปลใหม่
    const stale = mine.filter((c) => c.heldDays > 5);
    if (stale.length > 0) flags.push(`ไม่มีความเคลื่อนไหว ${stale.length} ใบ`);
    if (mine.length === 0) flags.push('ยังไม่มีการ์ดที่ถืออยู่');
    if (mine.length > 5) flags.push('งานชนกัน');

    return {
      userId: p.userId,
      name: p.name,
      jobTitle: p.jobTitle,
      holding: mine.length,
      cards: mine,
      flags,
    };
  });
}

export interface TeamRangeRow {
  userId: string;
  name: string;
  /** จำนวนการ์ดที่ถืออยู่ ณ วันนั้น — ไม่ใช่จำนวนที่ทำเสร็จ */
  perDay: { date: string; holding: number }[];
}

/**
 * โหมด "ช่วงเวลา" — ใครถูกจองช่วงไหน
 *
 * ═══ เกณฑ์ผ่านของ M8 · ย้อนหลังต้องคืนเจ้าของ ณ เวลานั้นได้ถูกต้อง ═══
 * ไม่ได้อ่านจาก tasks.assignee_id ซึ่งเป็นค่าปัจจุบัน
 * แต่ไล่จาก task_events หาว่า ณ สิ้นวันนั้น การ์ดแต่ละใบอยู่ในมือใคร
 *
 * ทำได้เพราะทุกการย้ายเขียน task_events หนึ่งแถวพร้อม to_user_id เสมอ (M5)
 * ถ้าเส้นทางไหนขยับการ์ดโดยไม่ผ่าน transition ตัวเลขในหน้านี้จะผิดทันที
 * — นี่คือเหตุผลที่กฎข้อ 4 ต้องเข้มขนาดนั้น
 */
export async function teamRange(tx: Tx, from: string, to: string): Promise<TeamRangeRow[]> {
  const rows = await tx.execute<{
    user_id: string;
    name: string;
    day: string;
    holding: number;
  }>(sql`
    with days as (
      select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day
    ),
    -- เจ้าของของการ์ดแต่ละใบ ณ สิ้นวันนั้น = to_user_id ของเหตุการณ์ล่าสุดที่ไม่เกินวันนั้น
    owner_at as (
      select d.day, t.id as task_id,
             (select e.to_user_id from task_events e
               where e.task_id = t.id and e.at < (d.day + interval '1 day')
               order by e.at desc limit 1) as owner
      from days d
      cross join tasks t
      join projects p on p.id = t.project_id and p.is_archived = false
      where t.created_at < (d.day + interval '1 day')
    )
    select o.owner as user_id, u.name, o.day::text as day, count(*)::int as holding
    from owner_at o
    join users u on u.id = o.owner
    where o.owner is not null
    group by o.owner, u.name, o.day
    order by u.name, o.day
  `);

  const byUser = new Map<string, TeamRangeRow>();
  for (const r of [...rows]) {
    const cur = byUser.get(r.user_id) ?? { userId: r.user_id, name: r.name, perDay: [] };
    cur.perDay.push({ date: r.day, holding: r.holding });
    byUser.set(r.user_id, cur);
  }
  return [...byUser.values()];
}

// ─────────────────────────── งานของฉัน · หน้าแรก · ปฏิทิน ───────────────────────────

/**
 * งานที่ได้รับ จัดกลุ่มตามความเร่งด่วน
 *
 * จัดกลุ่มจาก "อาการ" ไม่ใช่จากความเร่งด่วนที่ตั้งไว้
 * เพราะการ์ดที่ตั้ง critical แต่ยังไม่ถึงกำหนด ไม่ได้เร่งกว่าการ์ดที่เลยกำหนดไปแล้ว
 */
export async function myTasks(tx: Tx, userId: string) {
  const all = (await cards(tx, `t.assignee_id = '${userId}'`)).filter((c) => !c.isClosed);
  const today = new Date().toISOString().slice(0, 10);

  return {
    late: all.filter((c) => c.dueDate && c.dueDate < today),
    dueToday: all.filter((c) => c.dueDate === today),
    stale: all.filter((c) => c.heldDays > 5 && !(c.dueDate && c.dueDate <= today)),
    rest: all.filter((c) => !(c.dueDate && c.dueDate <= today) && c.heldDays <= 5),
    /** การ์ดที่ยังไม่ได้ตอบว่าจะเสร็จเมื่อไร */
    needEta: all.filter((c) => !c.eta),
    total: all.length,
  };
}

/**
 * หน้าแรก — สามบล็อกตามที่สเปคระบุ
 * รอตัดสินใจ · ต้องรีบ · โปรเจกต์ที่ดูแล
 */
export async function home(tx: Tx, userId: string) {
  const mine = (await cards(tx, `t.assignee_id = '${userId}'`)).filter((c) => !c.isClosed);
  const today = new Date().toISOString().slice(0, 10);

  const pmProjects = await tx
    .select({
      id: projects.id,
      key: projects.key,
      name: projects.name,
      dueOn: projects.dueOn,
    })
    .from(projects)
    .where(and(eq(projects.pmUserId, userId), eq(projects.isArchived, false)))
    // ตัวที่ไม่มีกำหนดส่งไปท้ายแถว ไม่ใช่ขึ้นก่อนเพราะ NULL เรียงก่อนโดยปริยาย
    .orderBy(sql`${projects.dueOn} asc nulls last`);

  // การ์ดที่รอ PM ตัดสิน — อยู่คอลัมน์รองสุดท้ายในโปรเจกต์ที่เราเป็น PM
  const pmIds = pmProjects.map((p) => p.id);
  const waiting = pmIds.length
    ? (await cards(tx, `t.project_id in (${pmIds.map((i) => `'${i}'`).join(',')})`)).filter(
        (c) => !c.isClosed && c.columnIndex === c.columnCount - 2,
      )
    : [];

  return {
    waitingOnYou: waiting,
    urgent: mine.filter((c) => c.dueDate && c.dueDate <= today),
    stale: mine.filter((c) => c.heldDays > 5),
    projects: pmProjects,
    holding: mine.length,
  };
}

/** ปฏิทินกำหนดส่ง — คืนเฉพาะการ์ดที่มีวันกำหนดในช่วงที่ขอ */
export async function calendar(tx: Tx, from: string, to: string, projectKey?: string) {
  const extra = projectKey ? ` and p.key = '${projectKey.replace(/'/g, "''")}'` : '';
  const rows = await cards(tx, `t.due_date between '${from}'::date and '${to}'::date${extra}`);
  const byDate = new Map<string, TaskCard[]>();
  for (const c of rows) {
    if (!c.dueDate) continue;
    const list = byDate.get(c.dueDate) ?? [];
    list.push(c);
    byDate.set(c.dueDate, list);
  }
  return [...byDate.entries()]
    .map(([date, items]) => ({ date, tasks: items }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─────────────────────────── การแจ้งเตือน ───────────────────────────

export async function listNotifications(tx: Tx, userId: string, unreadOnly = false) {
  const where = [eq(notifications.userId, userId)];
  if (unreadOnly) where.push(isNull(notifications.readAt));

  return tx
    .select({
      id: notifications.id,
      kind: notifications.kind,
      taskId: notifications.taskId,
      payload: notifications.payload,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: users.name,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(and(...where))
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function markNotificationsRead(
  tx: Tx,
  userId: string,
  opts: { ids?: string[]; all?: boolean },
): Promise<number> {
  const now = new Date();
  if (opts.all) {
    const r = await tx
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return r.length;
  }
  if (!opts.ids || opts.ids.length === 0) return 0;
  const r = await tx
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, opts.ids)))
    .returning({ id: notifications.id });
  return r.length;
}
