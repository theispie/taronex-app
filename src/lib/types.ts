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

/** สถานะคงที่ 4 ค่าตลอดไป (กฎข้อ 8) เปลี่ยนได้แค่ป้ายที่แสดง */
export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'review', 'done'] as const;

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
  warrantyScope?: WarrantyScope;
  isClientVisible: boolean;
}

/** รหัสที่ใช้อ้างอิงกันในไลน์หรือสแตนด์อัพ เช่น ACM-138 */
export function taskCode(t: Pick<Task, 'projectKey' | 'number'>): string {
  return `${t.projectKey}-${t.number}`;
}
