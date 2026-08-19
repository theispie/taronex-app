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
