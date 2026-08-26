/**
 * สคีมาฐานข้อมูล — ตรงกับพจนานุกรมข้อมูลใน docs/taronex-architecture.html
 * ยกเว้นจุดที่ตัดสินใหม่ภายหลัง ซึ่งกำกับเหตุผลไว้ทุกจุด
 *
 * ═══ สิ่งที่ต่างจากเอกสาร (เอกสารเก่ากว่าการตัดสินใจ ต้องแก้เอกสารตาม) ═══
 *
 * 1. ไม่มี enum `task_status` และไม่มีคอลัมน์ `tasks.status`
 *    แทนด้วย `projects.board` (jsonb: ชื่อ+ลำดับคอลัมน์) กับ `tasks.column_key`
 *    กติกาทั้งหมดคำนวณสดจากตำแหน่ง — กฎข้อ 8
 *
 * 2. `task_events` เก็บ "ชื่อคอลัมน์" และ "ตำแหน่ง" ณ ตอนนั้นด้วย
 *    เพราะคอลัมน์ลบได้และเปลี่ยนชื่อได้ แต่เหตุการณ์ลบไม่ได้ (กฎข้อ 5)
 *    ถ้าเก็บแค่ key วันที่มีคนลบคอลัมน์ ประวัติย้อนหลังทั้งหมดจะชี้ไปที่ของที่ไม่มีแล้ว
 *
 * 3. `tasks.portal_stage` — สถานะที่ลูกค้าเห็น ต้องมีคนกดเสมอ ไม่คำนวณจากบอร์ด
 *    ว่าง = ยังไม่มีเจ้าหน้าที่รับเรื่อง
 *
 * 4. `storage_provider` เป็น `spaces` ไม่ใช่ `r2` — ที่เก็บไฟล์จริงคือ DigitalOcean Spaces
 */

import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ─────────────────────────── ชนิดข้อมูลที่กำหนดค่าไว้ ───────────────────────────

export const membershipRole = pgEnum('membership_role', ['owner', 'member', 'viewer', 'guest']);
export const projectAccess = pgEnum('project_access', [
  'collaborate',
  'read_only',
  'read',
  'write',
]);
export const jobTitle = pgEnum('job_title', ['pm', 'ba', 'dev', 'qa', 'design', 'other']);
export const taskTypeSlot = pgEnum('task_type_slot', ['a', 'b', 'c']);
export const taskOrigin = pgEnum('task_origin', ['delivery', 'warranty']);
export const warrantyScope = pgEnum('warranty_scope', [
  'pending',
  'covered',
  'billable',
  'not_ours',
]);
export const priority = pgEnum('priority', ['low', 'medium', 'high', 'critical']);
export const reportedImpact = pgEnum('reported_impact', ['blocking', 'degraded', 'minor']);
export const taskEta = pgEnum('task_eta', ['today', 'tomorrow', 'this_week', 'unknown']);
export const phaseKind = pgEnum('phase_kind', ['normal', 'delivery', 'warranty']);
export const clockState = pgEnum('clock_state', ['running', 'paused', 'resolved']);
export const clockEventKind = pgEnum('clock_event_kind', [
  'start',
  'pause_hours',
  'pause_customer',
  'pause_vendor',
  'resume',
  'stop',
]);
export const storageProvider = pgEnum('storage_provider', ['spaces', 'gdrive', 'onedrive']);
export const notificationKind = pgEnum('notification_kind', [
  'assigned',
  'transferred',
  'rejected',
  'mentioned',
  'sla_warning',
  'client_reported',
]);
export const tenantStatus = pgEnum('tenant_status', ['trial', 'active', 'past_due', 'suspended']);

/**
 * สถานะที่ลูกค้าเห็นบนพอร์ทัล — ถ้อยคำยกจาก docs/screens/32.html ห้ามแปลใหม่
 * ทุกค่าต้องมีคนกดตั้ง ไม่มีค่าไหนที่ระบบตั้งเอง
 */
export const portalStage = pgEnum('portal_stage', [
  'received', // รับเรื่องแล้ว
  'investigating', // กำลังตรวจสอบ
  'fixing', // กำลังแก้ไข
  'verifying', // รอตรวจสอบผล
  'resolved', // แก้ไขแล้ว — PM เท่านั้น
]);

// ─────────────────────────── ตัวช่วยที่ใช้ซ้ำ ───────────────────────────

const pk = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ─────────────────────────── บัญชีและที่ทำงาน ───────────────────────────

export const tenants = pgTable('tenants', {
  id: pk(),
  name: text('name').notNull(),
  /** รหัสที่อยู่ใน URL /app/<code> — ไม่ใช่ความลับและไม่ใช่สิทธิ์ ดู src/lib/tenant-code.ts */
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),
  status: tenantStatus('status').notNull().default('trial'),
  timezone: text('timezone').notNull().default('Asia/Bangkok'),
  /** ใช้คำนวณ SLA — นาฬิกาเดินเฉพาะเวลาทำการ */
  businessHours: jsonb('business_hours')
    .notNull()
    .default({ days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', holidays: 'TH' }),
  createdAt: createdAt(),
});

/** ตารางเดียวที่ไม่มี RLS ตาม tenant — เข้าถึงผ่าน memberships เสมอ */
export const users = pgTable('users', {
  id: pk(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('th'),
  /** ปิดใช้งานแทนการลบ — task_events ต้องชี้ตัวตนเดิมได้เสมอ */
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: membershipRole('role').notNull(),
    /** แสดงผลและกรองเท่านั้น ไม่ผูกกับสิทธิ์แม้แต่ครั้งเดียวในทั้งระบบ */
    jobTitle: jobTitle('job_title').notNull().default('other'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [unique('memberships_tenant_user_uq').on(t.tenantId, t.userId)],
);

/**
 * session เก็บแค่ตัวตน ไม่ผูกกับที่ทำงาน — tenant มาจาก URL แล้วตรวจกับ memberships ทุก request
 *
 * เพิ่ม token_hash จากพจนานุกรมข้อมูลเดิม (20 ส.ค. 2569)
 * เอกสารเขียน id ว่า "เก็บเป็น hash ใน cookie" ซึ่งทำจริงไม่ได้ —
 * ถ้าคุกกี้เก็บ hash ของ id ก็ค้นย้อนกลับไม่ได้ ต้องไล่ hash ทุกแถวเทียบ
 * จึงใช้รูปแบบเดียวกับ invitations และ portal_tokens ที่มี token_hash อยู่แล้ว
 * คุกกี้ถือค่าดิบ ฐานข้อมูลถือแต่ hash — ฐานข้อมูลรั่วแล้วสวมสิทธิ์ไม่ได้
 */
export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_expires_idx').on(t.expiresAt)],
);

export const invitations = pgTable(
  'invitations',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: text('email').notNull(),
    jobTitle: jobTitle('job_title').notNull().default('other'),
    role: membershipRole('role').notNull().default('member'),
    /** เก็บ hash ไม่เก็บค่าดิบ */
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: uuid('invited_by').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByUserId: uuid('accepted_by_user_id').references(() => users.id),
  },
  (t) => [index('invitations_email_idx').on(t.email)],
);

// ─────────────────────────── ลูกค้าและพอร์ทัล ───────────────────────────

export const clients = pgTable('clients', {
  id: pk(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  name: text('name').notNull(),
  /** ตัวย่อ 1–3 ตัวสำหรับไอคอน */
  code: text('code').notNull(),
  note: text('note'),
  createdAt: createdAt(),
});

/** ไม่มี password_hash โดยตั้งใจ — เข้าได้ด้วยลิงก์ใช้ครั้งเดียวเท่านั้น · ไม่นับโควตา */
export const clientContacts = pgTable(
  'client_contacts',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    canReport: boolean('can_report').notNull().default(true),
    canSeeAll: boolean('can_see_all').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('client_contacts_email_idx').on(t.email)],
);

export const portalTokens = pgTable(
  'portal_tokens',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => clientContacts.id),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** ใช้แล้วเป็นโมฆะทันที */
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('portal_tokens_expires_idx').on(t.expiresAt)],
);

// ─────────────────────────── โปรเจกต์ ───────────────────────────

/** แม่แบบ · เก็บทั้งชุดเป็น JSON ไม่มีตารางลูก */
export const projectTemplates = pgTable('project_templates', {
  id: pk(),
  /** NULL = แม่แบบกลางของระบบ ใช้ได้ทุกที่ทำงาน */
  tenantId: uuid('tenant_id').references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  /** { board[{key,name}], type_labels, phases[], features[{name,color,tasks[…]}] } */
  definition: jsonb('definition').notNull(),
  createdFromProjectId: uuid('created_from_project_id'),
  useCount: integer('use_count').notNull().default(0),
  createdAt: createdAt(),
});

export const projects = pgTable(
  'projects',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    /** 3 ตัวอักษร · เปลี่ยนไม่ได้ · UNIQUE ต่อที่ทำงาน */
    key: text('key').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#5B5BD6'),
    /** คนเดียวที่ปิดการ์ดได้ */
    pmUserId: uuid('pm_user_id').references(() => users.id),
    /**
     * ชุดคอลัมน์ของบอร์ด — [{ key, name }, …] 2–8 คอลัมน์
     * แทนที่ column_labels เดิม · คอลัมน์มีแค่ชื่อกับลำดับ ห้ามเพิ่มฟิลด์ตั้งค่าใดๆ (กฎข้อ 8)
     * บังคับจำนวนด้วย CHECK ในไฟล์ migration ไม่ใช่แค่โค้ดฝั่งแอป
     */
    board: jsonb('board').notNull(),
    /** { "a": "งาน", "b": "บั๊ก" } สูงสุด 3 */
    typeLabels: jsonb('type_labels').notNull(),
    currentPhaseId: uuid('current_phase_id'),
    startsOn: date('starts_on').notNull(),
    /**
     * กำหนดส่งไม่บังคับ — งานประจำและงานดูแลหลังส่งมอบไม่มีวันจบ
     * ว่างแล้ว Timeline จะกางถึงการ์ดใบท้ายสุดแทน และไม่มีเส้นกำหนดส่งบนจอ
     */
    dueOn: date('due_on'),
    baselineTaskCount: integer('baseline_task_count'),
    baselineLockedAt: timestamp('baseline_locked_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** ตัวเลขช่วงส่งมอบที่ถูกแช่แข็ง */
    healthSnapshot: jsonb('health_snapshot'),
    memberAccess: projectAccess('member_access').notNull().default('collaborate'),
    /** คำนวณจากเฟส ไม่ให้ตั้งเอง */
    portalEnabled: boolean('portal_enabled').notNull().default(false),
    /** นับโควตาเฉพาะ false · ห้ามลบโปรเจกต์ ปิดได้อย่างเดียว (กฎข้อ 7) */
    isArchived: boolean('is_archived').notNull().default(false),
    /** ตัวนับสำหรับรหัส ACM-138 */
    nextTaskNumber: integer('next_task_number').notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    unique('projects_tenant_key_uq').on(t.tenantId, t.key),
    index('projects_archived_idx').on(t.isArchived),
  ],
);

/** วงจรชีวิตของโปรเจกต์ · คนละเรื่องกับคอลัมน์ของการ์ด */
export const projectPhases = pgTable('project_phases', {
  id: pk(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  description: text('description'),
  /** warranty = สวิตช์เปิดพอร์ทัลและ SLA */
  kind: phaseKind('kind').notNull().default('normal'),
  position: integer('position').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

/** งานหลัก · ไม่มีคอลัมน์วันที่โดยตั้งใจ — ช่วงงานคำนวณสดจากการ์ดลูก */
export const features = pgTable(
  'features',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    color: text('color').notNull().default('#5B5BD6'),
    position: integer('position').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('features_project_idx').on(t.projectId)],
);

/** รายชื่อยกเว้นสิทธิ์ + ทางเข้าของแขก · ตารางเดียวได้สองหน้าที่ */
export const projectMembers = pgTable(
  'project_members',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** read หรือ write เท่านั้น — ไม่ใช่ collaborate/read_only ซึ่งเป็นระดับโปรเจกต์ */
    access: projectAccess('access').notNull(),
    addedBy: uuid('added_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique('project_members_project_user_uq').on(t.projectId, t.userId),
    index('project_members_user_idx').on(t.userId),
  ],
);

// ─────────────────────────── การ์ดและประวัติ ───────────────────────────

export const tasks = pgTable(
  'tasks',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    /** ว่าง = งานนอกแผน */
    featureId: uuid('feature_id').references(() => features.id),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    /**
     * การ์ดใบนี้อยู่คอลัมน์ไหน — คีย์ต้องมีอยู่ใน projects.board
     * เปลี่ยนได้ทาง POST /tasks/:id/transition เท่านั้น (กฎข้อ 4)
     * บังคับด้วย trigger guard_task_column ไม่ใช่แค่โค้ดฝั่งแอป
     */
    columnKey: text('column_key').notNull(),
    typeSlot: taskTypeSlot('type_slot').notNull().default('a'),
    priority: priority('priority').notNull().default('medium'),
    /** ลูกค้าเลือก — เก็บแยกจาก priority ที่ทีมตั้ง */
    reportedImpact: reportedImpact('reported_impact'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    reporterId: uuid('reporter_id').references(() => users.id),
    /** ถ้าลูกค้าเป็นคนแจ้ง */
    contactId: uuid('contact_id').references(() => clientContacts.id),
    origin: taskOrigin('origin').notNull().default('delivery'),
    warrantyScope: warrantyScope('warranty_scope'),
    isClientVisible: boolean('is_client_visible').notNull().default(false),
    /**
     * สถานะที่ลูกค้าเห็น — ต้องมีคนกดเสมอ ไม่คำนวณจากบอร์ด
     * ว่าง = ยังไม่มีเจ้าหน้าที่รับเรื่อง ลูกค้าเห็น "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
     * เปลี่ยนได้ทาง POST /tasks/:id/portal-stage เท่านั้น
     */
    portalStage: portalStage('portal_stage'),
    portalStageAt: timestamp('portal_stage_at', { withTimezone: true }),
    portalStageBy: uuid('portal_stage_by').references(() => users.id),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    /** เตรียมไว้ ยังไม่ใช้ */
    estimateHours: numeric('estimate_hours'),
    eta: taskEta('eta'),
    etaUpdatedAt: timestamp('eta_updated_at', { withTimezone: true }),
    /** ลำดับในคอลัมน์ · แทรกกลางได้โดยไม่ต้องไล่เขียนใหม่ทั้งคอลัมน์ */
    position: doublePrecision('position').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    unique('tasks_project_number_uq').on(t.projectId, t.number),
    index('tasks_project_idx').on(t.projectId),
    index('tasks_column_idx').on(t.columnKey),
    index('tasks_assignee_idx').on(t.assigneeId),
    index('tasks_origin_idx').on(t.origin),
    index('tasks_due_idx').on(t.dueDate),
  ],
);

/**
 * บันทึกทุกการเคลื่อนไหว · เขียนอย่างเดียว REVOKE UPDATE/DELETE (กฎข้อ 5)
 *
 * เก็บทั้งคีย์ ชื่อ และตำแหน่งของคอลัมน์ ณ ตอนนั้น เพราะคอลัมน์ลบได้และเปลี่ยนชื่อได้
 * แต่เหตุการณ์ลบไม่ได้ ถ้าเก็บแค่คีย์ วันที่มีคนลบคอลัมน์
 * ประวัติย้อนหลังทั้งหมดจะชี้ไปที่ของที่ไม่มีแล้ว และซ่อมไม่ได้
 *
 * ตารางนี้จ่ายให้: ถือมากี่วัน · ธงค้างนาน · สถิติรอบตีกลับ · ประวัติการ์ด · ภาพรวมทีมย้อนหลัง
 */
export const taskEvents = pgTable(
  'task_events',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    /**
     * ว่างได้เมื่อการ์ดถูกลบจริง — FK ตั้ง ON DELETE SET NULL
     *
     * ทำแบบนี้เพราะกฎข้อ 5 ห้ามลบเหตุการณ์ และ role `app` ถูก REVOKE UPDATE/DELETE ไว้
     * ถ้า task_id เป็น NOT NULL แบบเดิม การลบการ์ดจะติด FK แล้วลบไม่ได้เลยสักใบ
     * ส่วนการตัด FK ให้ขาดเองก็ทำไม่ได้ เพราะ REVOKE UPDATE
     *
     * ฐานข้อมูลเป็นคนตัดให้ตอนลบ (referential action ไม่ติด REVOKE)
     * แถวเหตุการณ์จึงยังอยู่เป็นหลักฐานว่าเคยมีใครทำอะไรเมื่อไร
     * พร้อมชื่อคอลัมน์ ณ ตอนนั้นที่เก็บไว้แล้ว
     */
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    fromColumnKey: text('from_column_key'),
    toColumnKey: text('to_column_key'),
    /** ชื่อคอลัมน์ ณ ตอนนั้น — ไม่ join กลับไปที่ projects.board เพราะมันเปลี่ยนได้ */
    fromColumnName: text('from_column_name'),
    toColumnName: text('to_column_name'),
    /** ตำแหน่ง ณ ตอนนั้น — ใช้ตัดสินย้อนหลังว่าครั้งนั้นเป็นการเดินหน้าหรือตีกลับ */
    fromColumnIndex: integer('from_column_index'),
    toColumnIndex: integer('to_column_index'),
    /** จำนวนคอลัมน์ทั้งหมด ณ ตอนนั้น — ไม่งั้นบอกไม่ได้ว่าตอนนั้นเป็นคอลัมน์สุดท้ายหรือไม่ */
    columnCount: integer('column_count'),
    fromPortalStage: portalStage('from_portal_stage'),
    toPortalStage: portalStage('to_portal_stage'),
    fromUserId: uuid('from_user_id').references(() => users.id),
    toUserId: uuid('to_user_id').references(() => users.id),
    /** บังคับเมื่อตีกลับ */
    reason: text('reason'),
    actorId: uuid('actor_id').references(() => users.id),
    /** ถ้าลูกค้าเป็นคนทำ */
    actorContactId: uuid('actor_contact_id').references(() => clientContacts.id),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('task_events_task_idx').on(t.taskId), index('task_events_at_idx').on(t.at)],
);

export const comments = pgTable(
  'comments',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    authorId: uuid('author_id').references(() => users.id),
    authorContactId: uuid('author_contact_id').references(() => clientContacts.id),
    body: text('body').notNull(),
    /** true = ลูกค้าไม่เห็น · ค่าเริ่มต้นเป็น true เพราะพลาดทางนี้ปลอดภัยกว่า (กฎข้อ 6) */
    isInternal: boolean('is_internal').notNull().default(true),
    /** สร้างอัตโนมัติ เช่น เหตุผลตีกลับ */
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('comments_task_idx').on(t.taskId)],
);

/** ออกแบบให้ไม่ผูกกับผู้ให้บริการเก็บไฟล์ — สามคอลัมน์ท้ายทำตั้งแต่วันแรกเพราะเพิ่มทีหลังต้องย้ายข้อมูล */
export const attachments = pgTable(
  'attachments',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    /** ว่าง = ไฟล์ระดับโปรเจกต์ */
    taskId: uuid('task_id').references(() => tasks.id),
    commentId: uuid('comment_id').references(() => comments.id),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageProvider: storageProvider('storage_provider').notNull().default('spaces'),
    storageKey: text('storage_key'),
    externalId: text('external_id'),
    webUrl: text('web_url'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index('attachments_project_idx').on(t.projectId)],
);

/** เตรียมโครงไว้ ยังไม่ทำ UI — ทำตารางไว้เพื่อไม่ต้อง migrate ตอนเปิดโมดูลลงเวลา */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    minutes: integer('minutes').notNull(),
    spentOn: date('spent_on').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('time_entries_spent_idx').on(t.spentOn)],
);

// ─────────────────────────── งานประกันและ SLA ───────────────────────────

export const warrantyContracts = pgTable(
  'warranty_contracts',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id)
      .unique(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    scopeText: text('scope_text').notNull().default(''),
    renewNoticeDays: integer('renew_notice_days').notNull().default(30),
    createdAt: createdAt(),
  },
  (t) => [index('warranty_contracts_ends_idx').on(t.endsOn)],
);

/** เก็บเป็นเวอร์ชัน · แก้แล้วไม่กระทบเรื่องเก่า */
export const slaPolicies = pgTable('sla_policies', {
  id: pk(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  version: integer('version').notNull().default(1),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  countBusinessHours: boolean('count_business_hours').notNull().default(true),
  pauseOnCustomer: boolean('pause_on_customer').notNull().default(true),
  pauseOnVendor: boolean('pause_on_vendor').notNull().default(true),
  createdAt: createdAt(),
});

/** 4 แถวต่อหนึ่งเวอร์ชัน — หนึ่งแถวต่อหนึ่งระดับความเร่งด่วน */
export const slaPolicyLevels = pgTable(
  'sla_policy_levels',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => slaPolicies.id),
    priority: priority('priority').notNull(),
    respondMinutes: integer('respond_minutes').notNull(),
    resolveMinutes: integer('resolve_minutes').notNull(),
  },
  (t) => [unique('sla_policy_levels_policy_priority_uq').on(t.policyId, t.priority)],
);

/**
 * นาฬิกาหนึ่งเรือนต่อหนึ่งการ์ดประกัน
 *
 * นาฬิกาเริ่มเดิน ณ วินาทีที่ลูกค้ากดส่ง ไม่ใช่ตอนเจ้าหน้าที่กดรับเรื่อง
 * เวลาที่เรื่องนอนรออยู่จึงถูกนับ — ตัดสิน 20 ส.ค. 2569
 */
export const slaClocks = pgTable(
  'sla_clocks',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id)
      .unique(),
    /** ล็อกเวอร์ชันตอนสร้าง */
    policyId: uuid('policy_id')
      .notNull()
      .references(() => slaPolicies.id),
    /** คัดลอกค่ามาเก็บ ไม่ join ตอนอ่าน เพราะนโยบายเปลี่ยนเวอร์ชันได้ */
    targetRespondMinutes: integer('target_respond_minutes').notNull(),
    targetResolveMinutes: integer('target_resolve_minutes').notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    state: clockState('state').notNull().default('running'),
    createdAt: createdAt(),
  },
  (t) => [index('sla_clocks_state_idx').on(t.state)],
);

/** ช่วงเดินและหยุด · ไม่เก็บยอดรวมสะสมในคอลัมน์ใด เพราะแก้ย้อนหลังแล้วจะพิสูจน์ไม่ได้ */
export const slaClockEvents = pgTable(
  'sla_clock_events',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clockId: uuid('clock_id')
      .notNull()
      .references(() => slaClocks.id),
    kind: clockEventKind('kind').notNull(),
    reason: text('reason'),
    actorId: uuid('actor_id').references(() => users.id),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sla_clock_events_clock_idx').on(t.clockId),
    index('sla_clock_events_at_idx').on(t.at),
  ],
);

// ─────────────────────────── การแจ้งเตือน ───────────────────────────

/** ส่งอีเมลจริงแค่ 3 ชนิด: assigned · rejected · mentioned */
export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: notificationKind('kind').notNull(),
    taskId: uuid('task_id').references(() => tasks.id),
    actorId: uuid('actor_id').references(() => users.id),
    payload: jsonb('payload').notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId),
    index('notifications_created_idx').on(t.createdAt),
  ],
);

// ─────────────────────────── ความสัมพันธ์ ───────────────────────────

export const tenantsRelations = relations(tenants, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
  clients: many(clients),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  assignedTasks: many(tasks),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  tenant: one(tenants, { fields: [memberships.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  pm: one(users, { fields: [projects.pmUserId], references: [users.id] }),
  tasks: many(tasks),
  features: many(features),
  phases: many(projectPhases),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  feature: one(features, { fields: [tasks.featureId], references: [features.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  events: many(taskEvents),
  comments: many(comments),
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
  task: one(tasks, { fields: [taskEvents.taskId], references: [tasks.id] }),
  actor: one(users, { fields: [taskEvents.actorId], references: [users.id] }),
}));

/** ทุกตารางที่มี tenant_id ต้องเปิด RLS + FORCE — รายการนี้ใช้ตรวจในเทสต์ */
export const TENANT_SCOPED_TABLES = [
  'memberships',
  'invitations',
  'clients',
  'client_contacts',
  'portal_tokens',
  'project_templates',
  'projects',
  'project_phases',
  'features',
  'project_members',
  'tasks',
  'task_events',
  'comments',
  'attachments',
  'time_entries',
  'warranty_contracts',
  'sla_policies',
  'sla_policy_levels',
  'sla_clocks',
  'sla_clock_events',
  'notifications',
] as const;
