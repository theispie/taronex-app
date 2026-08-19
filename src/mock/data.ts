/**
 * ข้อมูลตัวอย่างสำหรับช่วง "ขึ้นหน้าจอก่อน" — ยังไม่มีฐานข้อมูล ยังไม่มี API
 * ตอนต่อ backend ให้ลบไฟล์นี้แล้วเปลี่ยนที่เรียกใช้เป็น query จริง
 * รูปทรงข้อมูลตรงกับ src/lib/types.ts เพื่อให้เปลี่ยนแล้วหน้าจอไม่ต้องแก้
 */
import type { Member, Project, Task, Tenant } from '@/lib/types';

export const CURRENT_USER = {
  id: 'u1', name: 'ธีรวุฒิ', initials: 'ธว', email: 'theerawut@digitalx.co.th',
};

export const TENANTS: Tenant[] = [
  { code: 'k7m2xq9btr4v', name: 'DigitalX Studio', status: 'active', plan: 'team',
    role: 'owner', waitingOnYou: 3 },
  { code: 'p4nh8wz3cyk6', name: 'ทองไทย มีเดีย', status: 'trial', plan: 'free',
    role: 'member', waitingOnYou: 0 },
];

export const MEMBERS: Member[] = [
  { id: 'u1', name: 'ธีรวุฒิ', initials: 'ธว', email: 'theerawut@digitalx.co.th',
    role: 'owner', jobTitle: 'pm', active: true },
  { id: 'u2', name: 'ณัฐพล', initials: 'ณพ', email: 'nut@digitalx.co.th',
    role: 'member', jobTitle: 'dev', active: true },
  { id: 'u3', name: 'ปรียา', initials: 'ปร', email: 'preeya@digitalx.co.th',
    role: 'member', jobTitle: 'design', active: true },
  { id: 'u4', name: 'สมชาย', initials: 'สช', email: 'somchai@digitalx.co.th',
    role: 'member', jobTitle: 'qa', active: true },
  { id: 'u5', name: 'กมล', initials: 'กม', email: 'kamol@thongthai.co.th',
    role: 'viewer', jobTitle: 'other', active: true },
];

export const PROJECTS: Project[] = [
  {
    id: 'p1', key: 'ACM', name: 'เว็บไซต์ Acme', clientName: 'บริษัท แอคมี จำกัด',
    pmUserId: 'u1', phase: { id: 'ph2', name: 'พัฒนา', kind: 'normal' },
    columnLabels: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'],
    typeLabels: ['งาน', 'บั๊ก', 'เอกสาร'],
    memberAccess: 'collaborate', baselineTaskCount: 32, isArchived: false,
    features: [
      { id: 'f1', name: 'ระบบสมาชิก', order: 1 },
      { id: 'f2', name: 'หน้าร้านค้า', order: 2 },
      { id: 'f3', name: 'ชำระเงิน', order: 3 },
      { id: 'f4', name: 'เชื่อมระบบบัญชี', order: 4 },
    ],
  },
  {
    id: 'p2', key: 'WEB', name: 'เว็บองค์กร ทองไทย', clientName: 'ทองไทย มีเดีย',
    pmUserId: 'u1', phase: { id: 'ph4', name: 'ประกัน', kind: 'warranty' },
    columnLabels: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'],
    typeLabels: ['งาน', 'เรื่องร้องเรียน', 'เอกสาร'],
    memberAccess: 'collaborate', baselineTaskCount: 24, isArchived: false,
    deliveredAt: '2026-05-14',
    features: [{ id: 'f5', name: 'งานประกัน', order: 1 }],
  },
  {
    id: 'p3', key: 'MKT', name: 'แคมเปญเปิดตัว Q3', clientName: 'บริษัท แอคมี จำกัด',
    pmUserId: 'u3', phase: { id: 'ph1', name: 'วางแผน', kind: 'normal' },
    columnLabels: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'],
    typeLabels: ['งาน', 'แก้ไข', 'เอกสาร'],
    memberAccess: 'read_only', baselineTaskCount: 18, isArchived: false,
    features: [
      { id: 'f6', name: 'คอนเทนต์', order: 1 },
      { id: 'f7', name: 'ยิงโฆษณา', order: 2 },
    ],
  },
];

const t = (
  n: number, title: string, status: Task['status'], featureId: string | null,
  assigneeId: string | null, heldDays: number, extra: Partial<Task> = {},
): Task => ({
  id: `t${n}`, projectKey: 'ACM', number: n, title, status, type: 'a',
  origin: 'delivery', priority: 'medium', featureId, assigneeId, heldDays,
  isClientVisible: false, ...extra,
});

export const TASKS: Task[] = [
  t(131, 'ออกแบบหน้าเข้าสู่ระบบ', 'done', 'f1', 'u3', 12),
  t(132, 'API สมัครสมาชิก', 'done', 'f1', 'u2', 9),
  t(133, 'ยืนยันอีเมลตอนสมัคร', 'doing', 'f1', 'u2', 4, { priority: 'high', eta: 'tomorrow' }),
  t(134, 'หน้ารายการสินค้า', 'doing', 'f2', 'u3', 2, { eta: 'today' }),
  t(135, 'ตะกร้าสินค้า', 'todo', 'f2', null, 0),
  t(136, 'เชื่อม Omise', 'todo', 'f3', 'u2', 0, { priority: 'critical', type: 'a' }),
  t(137, 'ใบเสร็จอิเล็กทรอนิกส์', 'todo', 'f3', null, 0),
  t(138, 'แก้บั๊กตะกร้าคำนวณส่วนลดผิด', 'review', 'f2', 'u2', 4,
    { type: 'b', priority: 'high', dueDate: '2026-08-21' }),
  t(139, 'ปรับข้อความหน้าชำระเงิน', 'review', 'f3', 'u3', 1, { type: 'c' }),
  t(140, 'ทดสอบโหลดหน้าแรก', 'todo', null, 'u4', 0),
  t(141, 'เพิ่มรายงานยอดขายรายวัน', 'todo', null, null, 0, { type: 'a', priority: 'low' }),
];

/** การ์ดของโปรเจกต์ WEB — อยู่ในช่วงประกัน จึงเป็น origin=warranty ทั้งหมด */
export const WEB_TASKS: Task[] = [
  { id: 'w1', projectKey: 'TT', number: 26, title: 'ฟอร์มติดต่อส่งอีเมลไม่ออก',
    status: 'doing', type: 'b', origin: 'warranty', priority: 'critical', featureId: 'f5',
    assigneeId: 'u2', heldDays: 0, warrantyScope: 'covered', isClientVisible: true },
  { id: 'w2', projectKey: 'TT', number: 27, title: 'อยากเพิ่มหน้าข่าวสารใหม่',
    status: 'todo', type: 'a', origin: 'warranty', priority: 'low', featureId: 'f5',
    assigneeId: null, heldDays: 2, warrantyScope: 'pending', isClientVisible: true },
  { id: 'w3', projectKey: 'TT', number: 28, title: 'รูปหน้าแรกโหลดช้ามาก',
    status: 'todo', type: 'b', origin: 'warranty', priority: 'high', featureId: 'f5',
    assigneeId: null, heldDays: 1, warrantyScope: 'pending', isClientVisible: true },
  { id: 'w4', projectKey: 'TT', number: 24, title: 'ลิงก์เมนูสินค้าเสีย',
    status: 'done', type: 'b', origin: 'warranty', priority: 'medium', featureId: 'f5',
    assigneeId: 'u2', heldDays: 0, warrantyScope: 'covered', isClientVisible: true },
  { id: 'w5', projectKey: 'TT', number: 25, title: 'ตรวจสาเหตุ SPF ของโดเมนผู้ส่ง',
    status: 'review', type: 'b', origin: 'warranty', priority: 'high', featureId: 'f5',
    assigneeId: 'u4', heldDays: 5, warrantyScope: 'covered', isClientVisible: false },
];

/** การ์ดของโปรเจกต์ MKT */
const m = (
  n: number, title: string, status: Task['status'], featureId: string | null,
  assigneeId: string | null, heldDays: number, extra: Partial<Task> = {},
): Task => ({
  id: `mk${n}`, projectKey: 'MKT', number: n, title, status, type: 'a',
  origin: 'delivery', priority: 'medium', featureId, assigneeId, heldDays,
  isClientVisible: false, ...extra,
});

export const MKT_TASKS: Task[] = [
  m(11, 'ร่างคีย์เมสเสจแคมเปญ', 'done', 'f6', 'u3', 6),
  m(12, 'เขียนคอนเทนต์ 8 ชิ้น', 'doing', 'f6', 'u3', 3, { eta: 'this_week' }),
  m(13, 'ถ่ายภาพสินค้า', 'todo', 'f6', null, 0),
  m(14, 'ตั้งค่าแคมเปญ Meta Ads', 'todo', 'f7', 'u2', 0, { priority: 'high' }),
  m(15, 'ตั้งงบและกลุ่มเป้าหมาย', 'review', 'f7', 'u1', 5),
  m(16, 'ขอสิทธิ์เข้าบัญชีโฆษณาลูกค้า', 'todo', null, null, 0, { priority: 'high' }),
];

export const WARRANTY_TASKS: Task[] = [
  { id: 'w1', projectKey: 'TT', number: 26, title: 'ฟอร์มติดต่อส่งอีเมลไม่ออก',
    status: 'doing', type: 'b', origin: 'warranty', priority: 'critical', featureId: 'f5',
    assigneeId: 'u2', heldDays: 0, warrantyScope: 'covered', isClientVisible: true },
  { id: 'w2', projectKey: 'TT', number: 27, title: 'อยากเพิ่มหน้าข่าวสารใหม่',
    status: 'todo', type: 'a', origin: 'warranty', priority: 'low', featureId: 'f5',
    assigneeId: null, heldDays: 2, warrantyScope: 'pending', isClientVisible: true },
  { id: 'w3', projectKey: 'TT', number: 28, title: 'รูปหน้าแรกโหลดช้ามาก',
    status: 'todo', type: 'b', origin: 'warranty', priority: 'high', featureId: 'f5',
    assigneeId: null, heldDays: 1, warrantyScope: 'pending', isClientVisible: true },
];

export function memberById(id: string | null): Member | undefined {
  return id ? MEMBERS.find((m) => m.id === id) : undefined;
}

export function tenantByCode(code: string): Tenant | undefined {
  return TENANTS.find((x) => x.code === code);
}

export function projectByKey(key: string): Project | undefined {
  return PROJECTS.find((p) => p.key === key);
}

/* ─────────── ข้อมูลเพิ่มสำหรับหน้าจอที่เหลือ ─────────── */

export interface Client {
  id: string; name: string; contacts: number; projects: number;
  portalEnabled: boolean; contractLevel?: string;
}
export const CLIENTS: Client[] = [
  { id: 'c1', name: 'บริษัท แอคมี จำกัด', contacts: 3, projects: 2, portalEnabled: false },
  { id: 'c2', name: 'ทองไทย มีเดีย', contacts: 2, projects: 1, portalEnabled: true,
    contractLevel: 'MA มาตรฐาน 12 เดือน' },
  { id: 'c3', name: 'สหกรณ์ครูภาคเหนือ', contacts: 4, projects: 1, portalEnabled: false },
  { id: 'c4', name: 'ร้านกาแฟบ้านสวน', contacts: 1, projects: 1, portalEnabled: false },
];

export interface Notification {
  id: string; kind: 'assigned' | 'transferred' | 'rejected' | 'mentioned' | 'sla_warning' | 'client_reported';
  title: string; body: string; at: string; unread: boolean;
}
export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', kind: 'rejected', title: 'ACM-138 ถูกตีกลับ',
    body: 'ยังคำนวณส่วนลดซ้อนกันอยู่ตอนใส่คูปองสองใบ ลองเคสนี้ก่อนส่งใหม่',
    at: 'วันนี้ 10:24', unread: true },
  { id: 'n2', kind: 'sla_warning', title: 'TT-026 ใกล้ครบกำหนด',
    body: 'เหลือ 45 นาทีก่อนครบกำหนดตามสัญญา', at: 'วันนี้ 09:50', unread: true },
  { id: 'n3', kind: 'client_reported', title: 'ทองไทย มีเดีย แจ้งเรื่องใหม่',
    body: 'รูปหน้าแรกโหลดช้ามาก', at: 'วันนี้ 08:15', unread: true },
  { id: 'n4', kind: 'assigned', title: 'ได้รับมอบหมาย ACM-136',
    body: 'พีรพล มอบหมาย “เชื่อม Omise” ให้คุณ', at: 'เมื่อวาน 16:02', unread: false },
  { id: 'n5', kind: 'mentioned', title: 'ถูกพูดถึงใน ACM-134',
    body: '@ณัฐกิตติ์ ช่วยดูขนาดรูปหน้ารายการหน่อย', at: 'เมื่อวาน 14:30', unread: false },
];

export interface Template {
  id: string; name: string; owner: 'team' | 'central'; features: string[];
  taskCount: number; columns: [string, string, string, string]; types: string[];
}
export const TEMPLATES: Template[] = [
  { id: 'tpl-web', name: 'เว็บไซต์องค์กร', owner: 'team',
    features: ['เก็บความต้องการ', 'ออกแบบ', 'พัฒนา', 'ทดสอบ', 'ส่งมอบ'],
    taskCount: 24, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'บั๊ก', 'เอกสาร'] },
  { id: 'tpl-hr', name: 'สรรหาพนักงาน', owner: 'central',
    features: ['เปิดรับ', 'คัดกรอง', 'สัมภาษณ์รอบ 1', 'สัมภาษณ์รอบ 2', 'ยื่นข้อเสนอ', 'เริ่มงาน'],
    taskCount: 21, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'ผู้สมัคร', 'เอกสาร'] },
  { id: 'tpl-mkt', name: 'แคมเปญการตลาด', owner: 'central',
    features: ['วางกลยุทธ์', 'ผลิตคอนเทนต์', 'ยิงโฆษณา', 'สรุปผล'],
    taskCount: 18, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'แก้ไข', 'เอกสาร'] },
  { id: 'tpl-event', name: 'จัดอีเวนต์', owner: 'central',
    features: ['วางแผน', 'จองสถานที่', 'ประชาสัมพันธ์', 'หน้างาน', 'สรุป'],
    taskCount: 26, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'ปัญหา', 'เอกสาร'] },
  { id: 'tpl-app', name: 'แอปมือถือ', owner: 'central',
    features: ['ออกแบบ UX', 'พัฒนา iOS', 'พัฒนา Android', 'ทดสอบ', 'ส่งขึ้นสโตร์'],
    taskCount: 32, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'บั๊ก', 'เอกสาร'] },
  { id: 'tpl-brand', name: 'ออกแบบแบรนด์', owner: 'central',
    features: ['วิจัย', 'ร่างแนวคิด', 'ออกแบบโลโก้', 'คู่มือแบรนด์'],
    taskCount: 14, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'แก้ไข', 'เอกสาร'] },
  { id: 'tpl-ma', name: 'สัญญาดูแลระบบ (MA)', owner: 'central',
    features: ['รับเรื่อง', 'คัดแยก', 'แก้ไข', 'ส่งมอบ'],
    taskCount: 8, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'], types: ['งาน', 'เรื่องร้องเรียน', 'เอกสาร'] },
  { id: 'tpl-blank', name: 'เริ่มจากศูนย์', owner: 'central',
    features: [], taskCount: 0, columns: ['รอทำ', 'กำลังทำ', 'รอตรวจ', 'เสร็จ'],
    types: ['งาน', 'บั๊ก', 'เอกสาร'] },
];

export interface Attachment {
  id: string; name: string; size: string; by: string; at: string; attachedTo: string;
}
export const FILES: Attachment[] = [
  { id: 'a1', name: 'wireframe-v2.fig', size: '4.2 MB', by: 'เมธาวี ต.', at: '3 วันก่อน', attachedTo: 'ACM-131' },
  { id: 'a2', name: 'สัญญาจ้าง-acme.pdf', size: '820 KB', by: 'พีรพล ว.', at: '1 สัปดาห์ก่อน', attachedTo: 'ACM-131' },
  { id: 'a3', name: 'โครงสร้างฐานข้อมูล.png', size: '1.1 MB', by: 'ณัฐกิตติ์ ส.', at: 'เมื่อวาน', attachedTo: 'ACM-132' },
  { id: 'a4', name: 'ผลทดสอบโหลด.xlsx', size: '96 KB', by: 'กรกช พ.', at: 'วันนี้', attachedTo: 'ACM-140' },
];

/** ขั้นของงานที่ลูกค้าเห็นในพอร์ทัล — 5 ขั้น วันที่อย่างเดียว ไม่มีเวลา ไม่มี SLA */
export const PORTAL_STEPS = [
  { label: 'รับเรื่องแล้ว', date: '14 ส.ค. 2569', done: true },
  { label: 'กำลังตรวจสอบ', date: '15 ส.ค. 2569', done: true },
  { label: 'กำลังแก้ไข', date: '18 ส.ค. 2569', done: true, current: true },
  { label: 'รอตรวจสอบ', date: '', done: false },
  { label: 'แก้ไขแล้ว', date: '', done: false },
];

export const SLA_LEVELS = [
  { name: 'วิกฤต', respond: '1 ชม.', resolve: '4 ชม.', desc: 'ระบบใช้งานไม่ได้ทั้งหมด' },
  { name: 'สูง', respond: '2 ชม.', resolve: '8 ชม.', desc: 'ฟังก์ชันหลักใช้ไม่ได้' },
  { name: 'กลาง', respond: '4 ชม.', resolve: '2 วันทำการ', desc: 'ใช้งานได้แต่ติดขัด' },
  { name: 'ต่ำ', respond: '1 วันทำการ', resolve: '5 วันทำการ', desc: 'เรื่องเล็กน้อย' },
];

export function clientById(id: string): Client | undefined {
  return CLIENTS.find((c) => c.id === id);
}
export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}


/**
 * การ์ดของโปรเจกต์หนึ่งๆ — ทุกหน้าที่แสดงการ์ดต้องเรียกผ่านตัวนี้
 * (ตอนต่อ backend จะกลายเป็น query ที่มี WHERE project_id ให้ RLS คุมอีกชั้น)
 */
export function tasksOfProject(key: string): Task[] {
  if (key === 'WEB') return WEB_TASKS;
  if (key === 'MKT') return MKT_TASKS;
  return TASKS;
}

/** ชื่องานหลักของการ์ดใบนั้น — null = งานนอกแผน */
export function featureNameOf(projectKey: string, featureId: string | null): string | null {
  if (!featureId) return null;
  return projectByKey(projectKey)?.features.find((f) => f.id === featureId)?.name ?? null;
}
