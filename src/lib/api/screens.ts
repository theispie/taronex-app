/**
 * หน้าจอทั้ง 52 หน้า ↔ endpoint ที่หน้านั้นต้องใช้
 *
 * ทำไมต้องมี — ทะเบียน endpoint ยกมาจากเอกสารสถาปัตยกรรม แต่เอกสารนั้นเขียน
 * ก่อนที่ต้นแบบจะครบ 52 หน้า ของที่ขาดจึงไม่มีทางรู้ด้วยการอ่านทะเบียนอย่างเดียว
 * ต้องไล่จากหน้าจอเข้าหา endpoint ถึงจะเห็นรู
 *
 * ตัวตรวจใน audit.ts จะฟ้องสองทาง:
 *   หน้าจอที่ไม่มี endpoint รองรับ  → หน้านั้นทำงานจริงไม่ได้
 *   endpoint ที่ไม่มีหน้าจอไหนเรียก → เขียนเผื่อไว้เกินจำเป็น
 *
 * เลขหน้าจอตรงกับ docs/SCREENS.md
 */

export interface Screen {
  no: string;
  name: string;
  /** endpoint ที่หน้านี้เรียก เขียนเป็น "METHOD /path" ให้ตรงกับทะเบียน */
  uses: string[];
}

/**
 * endpoint ที่ไม่ผูกกับหน้าจอใดหน้าจอหนึ่ง เพราะเป็นโครงสร้างพื้นฐาน
 * ต้องระบุไว้ตรงนี้ ไม่งั้นตัวตรวจจะฟ้องว่าไม่มีใครเรียก
 */
export const INFRASTRUCTURE = [
  'GET /auth/me', // ทุกหน้าที่ล็อกอินแล้วเรียกผ่าน layout
  'POST /auth/logout', // อยู่ในเมนูผู้ใช้ ไม่ใช่หน้าจอเดี่ยว
  'GET /meta/health',
  'GET /meta/endpoints',
  'GET /meta/openapi',
];

export const SCREENS: Screen[] = [
  { no: '01', name: 'สมัครใช้งาน', uses: ['POST /auth/signup'] },
  { no: '02', name: 'เข้าสู่ระบบ', uses: ['POST /auth/login'] },
  { no: '03', name: 'ลืมรหัสผ่าน', uses: ['POST /auth/forgot'] },
  { no: '04', name: 'ตั้งรหัสผ่านใหม่', uses: ['POST /auth/reset'] },
  {
    no: '05',
    name: 'รับคำเชิญเข้าทีม',
    uses: ['GET /invitations/:token', 'POST /invitations/:token/accept'],
  },
  {
    no: '06',
    name: 'ทางเข้าลูกค้า (ไม่ใช้รหัสผ่าน)',
    uses: ['POST /portal/request-link', 'POST /portal/verify'],
  },
  { no: '07', name: 'ตั้งค่าที่ทำงาน', uses: ['GET /workspace', 'PATCH /workspace'] },
  { no: '08', name: 'รายชื่อสมาชิก', uses: ['GET /members'] },
  {
    no: '08ข',
    name: 'สมาชิก — บทบาทและการโอนสิทธิ์',
    uses: [
      'PATCH /members/:id',
      'POST /members/:id/grant-owner',
      'POST /members/:id/revoke-owner',
      'POST /members/:id/deactivate',
      'DELETE /members/:id',
    ],
  },
  { no: '09', name: 'เชิญสมาชิก', uses: ['POST /members/invite'] },
  { no: '10', name: 'โปรไฟล์ผู้ใช้', uses: ['PATCH /me'] },
  { no: '11', name: 'รายการโปรเจกต์', uses: ['GET /projects'] },
  {
    no: '12',
    name: 'สร้าง / แก้ไขโปรเจกต์',
    uses: [
      'POST /projects',
      'PATCH /projects/:id',
      'POST /projects/:id/lock-baseline',
      'POST /projects/:id/archive',
    ],
  },
  {
    no: '13',
    name: 'ภาพรวมโปรเจกต์',
    uses: ['GET /projects/:id', 'GET /projects/:id/health'],
  },
  {
    no: '13ข',
    name: 'โปรเจกต์ในช่วงประกัน',
    uses: ['POST /projects/:id/deliver'],
  },
  { no: '14', name: 'สมาชิกในโปรเจกต์', uses: ['GET /projects/:id/members'] },
  {
    no: '15',
    name: 'ตั้งค่าเฟส',
    uses: [
      'GET /projects/:id/phases',
      'POST /projects/:id/phases',
      'POST /projects/:id/phases/:phaseId/enter',
    ],
  },
  {
    no: '16',
    name: 'ตั้งค่างานหลัก',
    uses: [
      'GET /projects/:id/features',
      'POST /projects/:id/features',
      'PATCH /features/:id',
      'DELETE /features/:id',
    ],
  },
  {
    no: '17',
    name: 'บอร์ด Kanban',
    uses: ['GET /projects/:id/tasks', 'POST /tasks/:id/transition'],
  },
  { no: '17ข', name: 'บอร์ด — จัดคอลัมน์ตามงานหลัก', uses: ['GET /projects/:id/tasks'] },
  { no: '18', name: 'มุมมองตาราง', uses: ['GET /projects/:id/tasks', 'PATCH /tasks/:id'] },
  { no: '19', name: 'Timeline / Gantt', uses: ['GET /projects/:id/timeline'] },
  {
    no: '20',
    name: 'รายละเอียดทิกเก็ต',
    uses: [
      'GET /tasks/:id',
      'GET /tasks/:id/comments',
      'POST /tasks/:id/comments',
      'GET /tasks/:id/events',
      'DELETE /tasks/:id',
    ],
  },
  { no: '21', name: 'สร้างทิกเก็ต', uses: ['POST /projects/:id/tasks'] },
  { no: '22', name: 'ค้นหาทั่วที่ทำงาน', uses: ['GET /search'] },
  { no: '23', name: 'หน้าแรก', uses: ['GET /home'] },
  { no: '24', name: 'งานที่ได้รับ', uses: ['GET /me/tasks', 'PATCH /tasks/:id/eta'] },
  { no: '25', name: 'ปฏิทินกำหนดส่ง', uses: ['GET /calendar'] },
  { no: '26', name: 'ภาพรวมทีม', uses: ['GET /team/overview'] },
  { no: '27', name: 'ภาพรวมทีม — ช่วงเวลา', uses: ['GET /team/timeline'] },
  { no: '28', name: 'รายชื่อลูกค้า', uses: ['GET /clients', 'POST /clients'] },
  {
    no: '29',
    name: 'เชิญคนของลูกค้า',
    uses: [
      'PATCH /clients/:id',
      'GET /clients/:id/contacts',
      'POST /clients/:id/contacts',
      'DELETE /contacts/:id',
    ],
  },
  { no: '30', name: 'พอร์ทัล — หน้าแรก', uses: ['GET /portal/issues'] },
  {
    no: '31',
    name: 'พอร์ทัล — แจ้งปัญหาใหม่',
    uses: ['POST /portal/issues', 'POST /portal/attachments/presign'],
  },
  { no: '32', name: 'พอร์ทัล — ติดตามเรื่อง', uses: ['GET /portal/issues/:code'] },
  { no: '33', name: 'ศูนย์งานประกัน / SLA', uses: ['GET /sla/overview'] },
  {
    no: '34',
    name: 'สัญญาและนโยบาย SLA',
    uses: ['GET /clients/:id/contract', 'PUT /clients/:id/contract'],
  },
  { no: '35', name: 'ศูนย์แจ้งเตือน', uses: ['GET /notifications', 'POST /notifications/read'] },
  { no: '36', name: 'โควตาเต็ม / ถูกระงับ', uses: ['GET /plans'] },
  {
    no: '37',
    name: 'ไฟล์ของโปรเจกต์',
    uses: [
      'GET /projects/:id/files',
      'POST /attachments/presign',
      'POST /attachments',
      'GET /attachments/:id/download',
      'DELETE /attachments/:id',
    ],
  },
  {
    no: '38',
    name: 'คิวคัดแยกเรื่องที่ลูกค้าแจ้ง',
    uses: ['GET /sla/triage', 'POST /tasks/:id/triage', 'POST /tasks/:id/portal-stage'],
  },
  {
    no: '39',
    name: 'ทิกเก็ตงานประกัน',
    uses: [
      'GET /tasks/:id/client-view',
      'POST /tasks/:id/portal-stage',
      'GET /sla/clocks/:taskId',
      'POST /sla/clocks/:taskId/pause',
      'POST /sla/clocks/:taskId/resume',
    ],
  },
  {
    no: '40',
    name: 'คลังแม่แบบโปรเจกต์',
    uses: [
      'GET /templates',
      'GET /templates/:id',
      'POST /templates/from-project/:projectId',
      'DELETE /templates/:id',
    ],
  },
  { no: '41', name: 'สร้าง / แก้ไขแม่แบบ', uses: ['POST /templates', 'PATCH /templates/:id'] },
  {
    no: '42',
    name: 'หน้ากลาง — ที่ทำงานของฉัน',
    uses: [
      'GET /me/workspaces',
      'GET /me/invitations',
      'POST /workspaces',
      'POST /workspaces/:id/leave',
      'POST /auth/switch-tenant',
    ],
  },
  {
    no: '43',
    name: 'ตั้งค่าบัญชีส่วนตัว',
    uses: [
      'PATCH /account',
      'POST /account/avatar',
      'DELETE /account/avatar',
      'PUT /account/locale',
    ],
  },
  { no: '44', name: 'รับคำเชิญ — อีเมลไม่ตรง', uses: ['GET /invitations/:token'] },
  {
    no: '45',
    name: 'สิทธิ์การเข้าถึงโปรเจกต์',
    uses: [
      'POST /projects/:id/members',
      'PATCH /projects/:id/members/:uid',
      'DELETE /projects/:id/members/:uid',
      'PATCH /projects/:id/access',
    ],
  },
  { no: '46', name: 'กิจกรรม — รายวัน', uses: ['GET /activity', 'POST /tasks/:id/progress'] },
  { no: '47', name: 'กิจกรรม — รายสัปดาห์ ตามโปรเจกต์', uses: ['GET /activity'] },
  { no: '48', name: 'กิจกรรม — รายเดือน', uses: ['GET /activity'] },
  { no: '49', name: 'กิจกรรม — แต่ละบทบาทเห็นอะไร', uses: ['GET /activity'] },
];

/** endpoint ทั้งหมดที่มีหน้าจออย่างน้อยหนึ่งหน้าเรียก */
export function usedByScreens(): Set<string> {
  const s = new Set<string>(INFRASTRUCTURE);
  for (const sc of SCREENS) for (const u of sc.uses) s.add(u);
  return s;
}
