/** ชนิดข้อมูลตามพจนานุกรมข้อมูลในสเปค — ห้ามเพิ่มค่านอกรายการนี้ */

export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
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
 * สถานะยังคงที่ 4 ค่า — แต่คนละเรื่องกับ "จำนวนคอลัมน์บนบอร์ด"
 * สถานะ = ความหมายที่ระบบใช้ตัดสินใจ · คอลัมน์ = สิ่งที่คนเห็นบนบอร์ด
 */
export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'review', 'done'] as const;

/**
 * คอลัมน์บนบอร์ด — แม่แบบกำหนดจำนวนและชื่อได้เอง
 * แต่ทุกคอลัมน์ต้องประกาศว่าตัวเองมีความหมายว่าอะไร (mapsTo)
 * ถ้าไม่มีบรรทัดนี้ ระบบจะไม่รู้ว่าคอลัมน์ไหนแปลว่า "ปิดงานแล้ว"
 * แล้วของที่พังตามคือ: ใครปิดการ์ดได้ · นาฬิกา SLA หยุดตอนไหน ·
 * พอร์ทัลบอกลูกค้าว่าถึงขั้นไหน · เปอร์เซ็นต์ความคืบหน้า · การเทียบข้ามโปรเจกต์
 */
export interface BoardColumn {
  key: string;
  name: string;
  mapsTo: TaskStatus;
}

export const STATUS_MEANING: Record<TaskStatus, string> = {
  todo: 'ยังไม่เริ่ม',
  doing: 'กำลังทำ',
  review: 'รอคนตรวจ',
  done: 'ปิดงานแล้ว',
};

/**
 * ระบบเดาความหมายให้จากชื่อคอลัมน์และตำแหน่ง — คนใช้ไม่ต้องรู้จักคำว่า "สถานะ"
 *
 * กติกา (ตามลำดับ):
 *   คอลัมน์แรก        → ยังไม่เริ่ม   (การ์ดใหม่ต้องมีที่ลง)
 *   คอลัมน์สุดท้าย     → ปิดงานแล้ว
 *   ชื่อมีคำว่าตรวจ/รีวิว/อนุมัติ/QA/UAT → รอคนตรวจ
 *   ที่เหลือ           → กำลังทำ
 *
 * เดาแล้วต้องให้คนเห็นและแก้ได้เสมอ ห้ามเดาเงียบๆ —
 * เดาผิดแล้วไม่มีใครรู้ คือกรณีที่แพงที่สุด (นาฬิกา SLA ผิด · พอร์ทัลบอกลูกค้าผิดขั้น)
 */
const REVIEW_WORDS = ['ตรวจ', 'รีวิว', 'review', 'อนุมัติ', 'approve', 'qa', 'uat', 'ยืนยัน'];

export function autoMapColumn(name: string, index: number, total: number): TaskStatus {
  if (index === 0) return 'todo';
  if (index === total - 1) return 'done';
  const n = name.toLowerCase();
  if (REVIEW_WORDS.some((w) => n.includes(w))) return 'review';
  return 'doing';
}

export function autoMapAll(names: string[]): BoardColumn[] {
  return names.map((name, i) => ({
    key: `c${i}`,
    name,
    mapsTo: autoMapColumn(name, i, names.length),
  }));
}

/** ผลที่ตามมาของแต่ละความหมาย — เขียนเป็นสิ่งที่เกิดขึ้นจริง ไม่ใช่ชื่อทางเทคนิค */
export const STATUS_EFFECT: Record<TaskStatus, string> = {
  todo: 'การ์ดที่สร้างใหม่มาลงคอลัมน์นี้',
  doing: 'เริ่มนับว่า “ถือมากี่วัน” และขึ้นในภาระงานของคนนั้น',
  review: 'ต้องเลือกผู้ตรวจ และตีกลับพร้อมเหตุผลได้',
  done: 'PM เท่านั้นที่ย้ายมาได้ · นาฬิกา SLA หยุด · ลูกค้าเห็นว่าเรื่องปิดแล้ว',
};

/** กติกาที่ชุดคอลัมน์ต้องผ่าน ก่อนบันทึกแม่แบบได้ */
export function validateColumns(cols: BoardColumn[]): string[] {
  const errs: string[] = [];
  if (cols.length < 2) errs.push('ต้องมีอย่างน้อย 2 คอลัมน์');
  if (cols.length > 8) errs.push('เกิน 8 คอลัมน์แล้วบอร์ดอ่านไม่ไหวบนจอเดียว');
  if (!cols.some((c) => c.mapsTo === 'todo')) errs.push('ต้องมีคอลัมน์ที่แปลว่า “ยังไม่เริ่ม” อย่างน้อยหนึ่ง — การ์ดใหม่ต้องมีที่ลง');
  if (!cols.some((c) => c.mapsTo === 'done')) errs.push('ต้องมีคอลัมน์ที่แปลว่า “ปิดงานแล้ว” อย่างน้อยหนึ่ง — ไม่งั้นระบบไม่รู้ว่างานจบเมื่อไร');
  const order = ['todo', 'doing', 'review', 'done'];
  let last = -1;
  for (const c of cols) {
    const i = order.indexOf(c.mapsTo);
    if (i < last) { errs.push('ลำดับคอลัมน์ต้องไล่จากยังไม่เริ่ม → กำลังทำ → รอตรวจ → ปิดงาน ย้อนกลับไม่ได้'); break; }
    last = i;
  }
  return errs;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface Member extends User {
  role: 'owner' | 'member' | 'viewer' | 'guest';
  jobTitle: JobTitle;   // แสดงผลและกรองเท่านั้น ไม่ผูกกับสิทธิ์
  active: boolean;
}

export interface Tenant {
  code: string;         // อยู่ใน URL: /app/<code>
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
  key: string;           // ACM — เปลี่ยนภายหลังไม่ได้
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
  status: TaskStatus;
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
  /** อยู่คอลัมน์ไหนบนบอร์ด — จำเป็นเมื่อหลายคอลัมน์แปลเป็นสถานะเดียวกัน */
  columnKey?: string;
  warrantyScope?: WarrantyScope;
  isClientVisible: boolean;
}

/** รหัสที่ใช้อ้างอิงกันในไลน์หรือสแตนด์อัพ เช่น ACM-138 */
export function taskCode(t: Pick<Task, 'projectKey' | 'number'>): string {
  return `${t.projectKey}-${t.number}`;
}
