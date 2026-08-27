/** ชนิดข้อมูลตามพจนานุกรมข้อมูลในสเปค — ห้ามเพิ่มค่านอกรายการนี้ */

/**
 * ไม่มี task_status ในฐานข้อมูลอีกแล้ว — เหลือไว้เป็นชื่อ "โทนสี" บนหน้าจอเท่านั้น
 * ซึ่งคำนวณจากตำแหน่งคอลัมน์ ไม่ได้เก็บที่ไหน
 */
export type Tone = 'todo' | 'doing' | 'review' | 'done';
export type TaskTypeSlot = 'a' | 'b' | 'c';
export type TaskOrigin = 'delivery' | 'warranty';
export type WarrantyScope = 'pending' | 'covered' | 'billable' | 'not_ours';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ReportedImpact = 'blocking' | 'degraded' | 'minor';
export type TaskEta = 'today' | 'tomorrow' | 'this_week' | 'unknown';
export type PhaseKind = 'normal' | 'delivery' | 'warranty';
export type ClockState = 'running' | 'paused' | 'resolved';
export type JobTitle = 'pm' | 'ba' | 'dev' | 'qa' | 'design' | 'other';
export type TenantStatus = 'trial' | 'active' | 'past_due' | 'suspended';

/**
 * ═══ สถานะที่ลูกค้าเห็นบนพอร์ทัล ═══
 *
 * ตัดสินเมื่อ 20 ส.ค. 2569 — **ไม่คำนวณจากบอร์ดเด็ดขาด**
 *
 * เหตุผล: ถ้าแปลงจากตำแหน่งคอลัมน์ ลูกค้าจะเห็นสถานะขยับทุกครั้งที่ทีมลากการ์ด
 * ลากผิดแล้วลากกลับ ลูกค้าก็เห็นกระพริบ และไม่มีใครตั้งใจบอกลูกค้าสักครั้ง
 * สำหรับสินค้าที่ขายงานประกันกับ SLA อันนี้รับไม่ได้
 *
 * ทุกขั้นต้องมีคนกดเท่านั้น · ไม่มี auto ในทุกกรณี
 * ค่าว่าง (null) = ยังไม่มีเจ้าหน้าที่รับเรื่อง ลูกค้าเห็นว่า "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
 * ซึ่งเป็นใบรับ ไม่ใช่การอ้างความคืบหน้า
 *
 * ถ้อยคำยกจากต้นแบบ docs/screens/32.html ห้ามแปลใหม่
 */
export type PortalStage = 'received' | 'investigating' | 'fixing' | 'verifying' | 'resolved';

export const PORTAL_STAGE_LABEL: Record<PortalStage, string> = {
  received: 'รับเรื่องแล้ว',
  investigating: 'กำลังตรวจสอบ',
  fixing: 'กำลังแก้ไข',
  verifying: 'รอตรวจสอบผล',
  resolved: 'แก้ไขแล้ว',
};

/** ลำดับที่แสดงบนแถบ 5 ขั้น */
export const PORTAL_STAGE_ORDER: PortalStage[] = [
  'received',
  'investigating',
  'fixing',
  'verifying',
  'resolved',
];

/** ข้อความตอนที่ยังไม่มีใครรับเรื่อง — เป็นใบรับ ไม่ใช่สถานะ */
export const PORTAL_STAGE_NONE = 'ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง';

/**
 * ขั้นสุดท้ายเป็นคำสัญญากับลูกค้า จึงล็อกไว้ที่ PM เหมือนการปิดการ์ด (กฎข้อ 8)
 * ขั้นอื่นใครที่มีสิทธิ์เขียนในโปรเจกต์ก็กดได้ — ไม่เกี่ยวกับตำแหน่งงาน
 */
export function portalStageIsPmOnly(stage: PortalStage): boolean {
  return stage === 'resolved';
}

/**
 * ═══ คอลัมน์บนบอร์ด ═══
 *
 * คอลัมน์มีแค่ชื่อ ไม่มีธง ไม่มีการตั้งค่าอะไรทั้งนั้น
 * คนสร้างการ์ดเลือกเองว่าจะลงคอลัมน์ไหน แล้วลากย้ายเอา
 *
 * ระบบไม่ถามอะไรเลย แต่ยังรู้สิ่งที่ต้องรู้ เพราะอ่านจาก "ลำดับ" กับ "ทิศทางการลาก":
 *
 *   คอลัมน์แรก      → การ์ดใหม่มาลงที่นี่เป็นค่าเริ่มต้น
 *   คอลัมน์สุดท้าย   → ปิดงาน · PM เท่านั้นที่ลากมาได้ · นาฬิกา SLA หยุด · ไม่นับใน "ถืออยู่"
 *   ลากไปข้างหน้า    → ย้ายปกติ
 *   ลากถอยหลัง      → ตีกลับ ต้องใส่เหตุผล และการ์ดกลับไปหาเจ้าของคนก่อน
 *
 * ทั้งหมดนี้เป็นธรรมเนียมที่คนใช้คานบันเข้าใจอยู่แล้ว ไม่ต้องเรียนรู้ใหม่
 */
export interface BoardColumn {
  key: string;
  name: string;
}

/** ตำแหน่งของคอลัมน์ — ใช้ตัดสินกติกาและสีที่แสดง */
export type ColumnRole = 'first' | 'middle' | 'last';

export function columnRole(index: number, total: number): ColumnRole {
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
}

/**
 * สีบนหน้าจอ — คำนวณจากตำแหน่ง ไม่ได้เก็บในฐานข้อมูล
 * คอลัมน์ก่อนสุดท้ายใช้สีของขั้นตรวจ เพราะบอร์ดส่วนใหญ่วางขั้นตรวจไว้ตรงนั้น
 * (เป็นแค่เรื่องสี ไม่มีผลกับกติกาใดๆ)
 */
export function columnTone(index: number, total: number): Tone {
  if (index === 0) return 'todo';
  if (index === total - 1) return 'done';
  if (index === total - 2 && total >= 3) return 'review';
  return 'doing';
}

/** กติกาที่ชุดคอลัมน์ต้องผ่าน */
export function validateColumns(cols: BoardColumn[]): string[] {
  const errs: string[] = [];
  if (cols.length < 2) errs.push('ต้องมีอย่างน้อย 2 คอลัมน์ — คอลัมน์แรกคือที่ที่การ์ดใหม่มาลง คอลัมน์สุดท้ายคือปิดงาน');
  if (cols.length > 8) errs.push('เกิน 8 คอลัมน์แล้วบอร์ดอ่านไม่ไหวบนจอเดียว');
  const names = cols.map((c) => c.name.trim());
  if (names.some((n) => !n)) errs.push('ทุกคอลัมน์ต้องมีชื่อ');
  if (new Set(names).size !== names.length) errs.push('ชื่อคอลัมน์ห้ามซ้ำกัน');
  return errs;
}

/** ผลที่ตามมาของแต่ละตำแหน่ง — ใช้แสดงให้คนตั้งแม่แบบเห็นว่าจะเกิดอะไรขึ้น */
export const ROLE_EFFECT: Record<ColumnRole, string> = {
  first: 'การ์ดที่สร้างใหม่มาลงคอลัมน์นี้',
  middle: 'ย้ายเข้าออกได้ตามปกติ',
  last: 'ถือว่าปิดงาน · PM เท่านั้นที่ลากมาได้ · นาฬิกา SLA หยุด · ไม่นับใน “ถืออยู่”',
};

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface Member extends User {
  role: 'owner' | 'member' | 'viewer' | 'guest';
  jobTitle: JobTitle; // แสดงผลและกรองเท่านั้น ไม่ผูกกับสิทธิ์
  active: boolean;
}

export interface Tenant {
  code: string; // อยู่ใน URL: /app/<code>
  name: string;
  status: TenantStatus;
  plan: 'free' | 'team' | 'business';
  role: Member['role']; // บทบาทของผู้ใช้ที่ล็อกอินอยู่ ในที่ทำงานนี้
  waitingOnYou: number;
}

export interface Feature {
  id: string;
  name: string;
  order: number;
}

export interface Phase {
  id: string;
  name: string;
  kind: PhaseKind;
}

export interface Project {
  id: string;
  key: string; // ACM — เปลี่ยนภายหลังไม่ได้
  name: string;
  clientName: string;
  pmUserId: string;
  phase: Phase;
  /** ชุดคอลัมน์ของโปรเจกต์นี้ คัดลอกจากแม่แบบตอนสร้าง · ไม่มี = ใช้ชุดมาตรฐาน 4 คอลัมน์ */
  board?: BoardColumn[];
  columnLabels: [string, string, string, string];
  typeLabels: [string, string, string];
  memberAccess: 'collaborate' | 'read_only';
  baselineTaskCount: number;
  isArchived: boolean;
  deliveredAt?: string;
  features: Feature[];
}

export interface Task {
  id: string;
  projectKey: string;
  number: number;
  title: string;
  /** ข้อมูลที่เก็บจริงมีแค่นี้ — การ์ดใบนี้อยู่คอลัมน์ไหน */
  columnKey: string;
  type: TaskTypeSlot;
  origin: TaskOrigin;
  priority: Priority;
  featureId: string | null;
  assigneeId: string | null;
  dueDate?: string;
  startDate?: string;
  eta?: TaskEta;
  /** วันที่ถืออยู่ในสถานะปัจจุบัน — คำนวณสดจาก task_events ตอนต่อ backend */
  heldDays: number;
  warrantyScope?: WarrantyScope;
  isClientVisible: boolean;
}

/** รหัสที่ใช้อ้างอิงกันในไลน์หรือสแตนด์อัพ เช่น ACM-138 */
export function taskCode(t: Pick<Task, 'projectKey' | 'number'>): string {
  return `${t.projectKey}-${t.number}`;
}

/** หาว่าการ์ดอยู่คอลัมน์ที่เท่าไร */
export function columnIndexOf(t: Pick<Task, 'columnKey'>, cols: BoardColumn[]): number {
  const i = cols.findIndex((c) => c.key === t.columnKey);
  return i < 0 ? 0 : i;
}

/** โทนสีของการ์ด — คำนวณสด ไม่ได้เก็บ */
export function toneOf(t: Pick<Task, 'columnKey'>, cols: BoardColumn[]): Tone {
  return columnTone(columnIndexOf(t, cols), cols.length);
}

/** ปิดงานแล้วหรือยัง = อยู่คอลัมน์สุดท้ายหรือเปล่า */
export function isClosed(t: Pick<Task, 'columnKey'>, cols: BoardColumn[]): boolean {
  return columnIndexOf(t, cols) === cols.length - 1;
}

/** ชื่อคอลัมน์ที่การ์ดอยู่ */
export function columnNameOf(t: Pick<Task, 'columnKey'>, cols: BoardColumn[]): string {
  return cols[columnIndexOf(t, cols)]?.name ?? '';
}

/**
 * ลากการ์ดจากคอลัมน์หนึ่งไปอีกคอลัมน์ — ระบบตัดสินจากทิศทางล้วนๆ
 * ถอยหลัง = ตีกลับ การ์ดกลับไปหาเจ้าของคนก่อน · เข้าคอลัมน์สุดท้าย = ปิดงาน PM เท่านั้น
 *
 * ⚠ เดิมการตีกลับบังคับให้ใส่เหตุผลก่อนถึงจะย้ายได้ ตอนนี้ไม่บังคับแล้ว
 *   บอร์ดคือของที่คนขยับวันละหลายสิบครั้ง การถามทุกครั้งทำให้ช้าจนคนเลิกใช้
 *   เหตุผลยังใส่ได้ผ่านคอมเมนต์ และการตีกลับยังลง `task_events` ครบเหมือนเดิม
 */
export interface MoveCheck {
  kind: 'forward' | 'backward' | 'close';
  pmOnly: boolean;
}

export function checkMove(from: number, to: number, total: number): MoveCheck {
  if (to === total - 1) return { kind: 'close', pmOnly: true };
  if (to < from) return { kind: 'backward', pmOnly: false };
  return { kind: 'forward', pmOnly: false };
}
