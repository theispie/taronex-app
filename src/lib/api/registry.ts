/**
 * ทะเบียน endpoint ทั้งระบบ — แหล่งความจริงเดียว
 *
 * รายการนี้ยกมาจากหัวข้อ API ใน docs/taronex-architecture.html
 * แล้วแก้ให้ตรงกับการตัดสินใจที่เปลี่ยนไปแล้ว (ดู note ของแต่ละรายการ)
 *
 * ใครเพิ่ม route ใหม่ ต้องเพิ่มแถวที่นี่ด้วย มิฉะนั้นหน้า /internal/api จะขึ้นว่า
 * "มี route ที่ไม่อยู่ในทะเบียน" — ตั้งใจให้ลืมไม่ได้
 *
 * ทุกเส้นทางอยู่ใต้ /api/v1 และเสิร์ฟจริงที่ /app/api/v1 เพราะ basePath = /app
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * ขอบเขตข้อมูลที่ endpoint แตะได้ — ตัวนี้บังคับกฎข้อ 11
 *   public   ไม่ต้องล็อกอิน
 *   account  ข้ามที่ทำงานได้ (มีได้แค่ 4 รายการเท่านั้น)
 *   tenant   ผูกกับ app.tenant_id เสมอ
 *   portal   คนละการยืนยันตัวตน คนละ serializer (กฎข้อ 6)
 *   meta     ข้อมูลของระบบเอง ไม่แตะข้อมูลผู้ใช้
 */
export type Scope = 'public' | 'account' | 'tenant' | 'portal' | 'meta';

/** สถานะการทำจริง — ไม่ใช่ผลตรวจสด ผลตรวจสดอยู่ที่หน้า /internal/api */
export type ImplStatus = 'live' | 'partial' | 'planned';

export type Milestone =
  | 'M2'
  | 'M3'
  | 'M4'
  | 'M5'
  | 'M6'
  | 'M7'
  | 'M8'
  | 'M9'
  | 'M10'
  | 'M11'
  | 'M11ข'
  | 'M12'
  | '—';

export interface Endpoint {
  method: HttpMethod;
  /** เส้นทางใต้ /api/v1 */
  path: string;
  summary: string;
  scope: Scope;
  milestone: Milestone;
  status: ImplStatus;
  /** สิทธิ์ขั้นต่ำที่ resolveAccess ต้องคืน — กฎข้อ 10 */
  access?: 'read' | 'write';
  /** กฎข้อที่ endpoint นี้ต้องบังคับ อ้างเลขข้อใน CLAUDE.md */
  rules?: number[];
  /** query ข้าม tenant ได้ — ต้องตรงกับ CROSS_TENANT_ALLOWLIST เป๊ะ (กฎข้อ 11) */
  crossTenant?: true;
  /** ต่างจากเอกสารสถาปัตยกรรมยังไง หรือยังไม่ได้ตัดสินอะไร */
  note?: string;
}

export interface EndpointGroup {
  name: string;
  endpoints: Endpoint[];
}

/**
 * กฎข้อ 11 — มีสี่ endpoint เท่านั้นที่ query ข้าม tenant ได้
 * รายชื่อนี้คือตัวตัดสิน ไม่ใช่ความจำของคนเขียนโค้ด
 */
export const CROSS_TENANT_ALLOWLIST = [
  'GET /me/workspaces',
  'GET /me/invitations',
  'POST /workspaces',
  'POST /invitations/:token/accept',
] as const;

export const API_BASE = '/api/v1';

/**
 * เส้นทางในทะเบียนเป็น "เส้นทางเชิงตรรกะ" — ยังไม่รวมรหัสที่ทำงาน
 *
 * ของจริงที่เสิร์ฟ: endpoint ที่ scope = 'tenant' อยู่ใต้ /api/v1/t/{tenant}/…
 * เพราะแยกที่ทำงานด้วย path ไม่ใช่ subdomain (ตัดสินไว้ตั้งแต่ session แรก)
 * ส่วน scope อื่นอยู่ใต้ /api/v1/… ตรงๆ
 *
 * รหัสใน path **ไม่ใช่สิทธิ์** — requireTenant() ตรวจ memberships ทุก request
 * ไม่ผ่านตอบ 404 ไม่ใช่ 403
 */
export const TENANT_PATH_PREFIX = '/t/{tenant}';

/** เส้นทางจริงที่เสิร์ฟของ endpoint หนึ่งตัว */
export function servedPath(e: Pick<Endpoint, 'path' | 'scope'>): string {
  return e.scope === 'tenant' ? `${TENANT_PATH_PREFIX}${e.path}` : e.path;
}

export const GROUPS: EndpointGroup[] = [
  {
    name: 'ยืนยันตัวตน',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/signup',
        summary: 'สร้าง tenant + owner + session ในธุรกรรมเดียว',
        scope: 'public',
        milestone: 'M2',
        status: 'live',
        rules: [12],
      },
      {
        method: 'POST',
        path: '/auth/login',
        summary: 'คืน session cookie httpOnly · SameSite=Lax',
        scope: 'public',
        milestone: 'M2',
        status: 'live',
      },
      {
        method: 'POST',
        path: '/auth/logout',
        summary: 'ทำลาย session ปัจจุบัน',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
      },
      {
        method: 'POST',
        path: '/auth/forgot',
        summary: 'ส่งลิงก์ตั้งรหัสใหม่ · ตอบเหมือนกันเสมอไม่ว่าอีเมลมีจริงหรือไม่',
        scope: 'public',
        milestone: 'M2',
        status: 'live',
      },
      {
        method: 'POST',
        path: '/auth/reset',
        summary: 'ตั้งรหัสใหม่ + ทำลาย session ทุกเครื่อง',
        scope: 'public',
        milestone: 'M2',
        status: 'live',
      },
      {
        method: 'GET',
        path: '/auth/me',
        summary: 'ใครล็อกอินอยู่ — คืนแค่ตัวตน ไม่คืนรายการที่ทำงาน',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        note: 'เอกสารเดิมว่าคืน "ที่ทำงานปัจจุบัน + สิทธิ์" ด้วย · ตัดออกเพราะรายการที่ทำงานเป็นข้อมูลข้าม tenant ซึ่งกฎข้อ 11 อนุญาตแค่สี่เส้นทาง · ที่ทำงานปัจจุบันมาจาก URL และบทบาทอยู่ที่ GET /workspace',
      },
      {
        method: 'POST',
        path: '/auth/switch-tenant',
        summary: 'สลับที่ทำงาน = สร้าง session ใหม่',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
      },
      {
        method: 'GET',
        path: '/invitations/:token',
        summary: 'อ่านคำเชิญก่อนกดรับ — ชื่อที่ทำงาน ผู้เชิญ บทบาท และอีเมลปลายทาง',
        scope: 'public',
        milestone: 'M2',
        status: 'live',
        note: 'ไม่มีในเอกสารเดิม · หน้าจอ 44 ต้องรู้ว่าอีเมลที่ล็อกอินอยู่ไม่ตรงกับคำเชิญ จึงต้องอ่านได้ก่อนรับ',
      },
      {
        method: 'POST',
        path: '/invitations/:token/accept',
        summary: 'รับคำเชิญ ตั้งรหัสผ่าน เข้าทีม',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        crossTenant: true,
        rules: [11],
      },
    ],
  },
  {
    name: 'บัญชีและหลายที่ทำงาน (นอกขอบเขต tenant)',
    endpoints: [
      {
        method: 'GET',
        path: '/me/workspaces',
        summary: 'รายการที่ทำงาน + บทบาท + จำนวนงานค้าง · กรองด้วย user_id ของ session เท่านั้น',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        crossTenant: true,
        rules: [11],
      },
      {
        method: 'GET',
        path: '/me/invitations',
        summary: 'คำเชิญที่ยังไม่ตอบของอีเมลนี้',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        crossTenant: true,
        rules: [11],
      },
      {
        method: 'POST',
        path: '/workspaces',
        summary: 'สร้างที่ทำงานใหม่จากบัญชีเดิม',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        crossTenant: true,
        rules: [11, 12],
      },
      {
        method: 'POST',
        path: '/workspaces/:id/leave',
        summary: 'ออกจากที่ทำงาน · เจ้าของคนสุดท้ายออกไม่ได้',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'read',
        rules: [12],
        note: 'เป็นสมาชิกก็ออกเองได้ ไม่ต้องมีสิทธิ์เขียน',
      },
      {
        method: 'PATCH',
        path: '/account',
        summary: 'ชื่อ · รูป · ภาษา · รหัสผ่าน (ข้อมูลของคน ไม่ใช่ของที่ทำงาน)',
        scope: 'account',
        milestone: 'M2',
        status: 'live',
        note: 'แก้ข้อมูลของตัวเองเท่านั้น จึงไม่ต้องอยู่ในรายชื่อกฎข้อ 11',
      },
    ],
  },
  {
    name: 'ที่ทำงานและสมาชิก',
    endpoints: [
      {
        method: 'GET',
        path: '/workspace',
        summary: 'ข้อมูลที่ทำงาน + โควตาที่ใช้ไป',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'read',
      },
      {
        method: 'PATCH',
        path: '/workspace',
        summary: 'ชื่อ · โลโก้ · เขตเวลา · เวลาทำการ',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/plans',
        summary: 'รายการแผนและโควตาของแต่ละแผน + แผนปัจจุบัน',
        scope: 'tenant',
        milestone: 'M12',
        status: 'live',
        access: 'read',
        rules: [7],
        note: 'ไม่มีในเอกสารเดิม · หน้าจอ 36 · อ่านอย่างเดียว ไม่มีเส้นทางลบข้อมูลตามกฎข้อ 7',
      },
      {
        method: 'GET',
        path: '/members',
        summary: 'รายชื่อสมาชิก + จำนวนการ์ดที่ถือ + เป็น PM ของอะไร',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/members/invite',
        summary: 'ส่งคำเชิญได้หลายอีเมลในครั้งเดียว',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
      },
      {
        method: 'PATCH',
        path: '/members/:id',
        summary: 'เปลี่ยนตำแหน่งงานหรือบทบาท · owner เท่านั้น',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
        note: 'job_title เก็บที่ memberships ไม่ใช่ users (ข้อขัดแย้งใน 08.md ยึดตาม M1)',
      },
      {
        method: 'POST',
        path: '/members/:id/grant-owner',
        summary: 'แต่งตั้งเป็นเจ้าของ · ไม่ต้องรอปลายทางกดรับ',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
      },
      {
        method: 'POST',
        path: '/members/:id/revoke-owner',
        summary: 'ถอดจากเจ้าของ · ปฏิเสธถ้าเหลือคนเดียว',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
        rules: [12],
      },
      {
        method: 'POST',
        path: '/members/:id/deactivate',
        summary: 'ปิดใช้งาน · ถ้าเป็น PM ต้องเลือกคนรับช่วงก่อน',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
      },
      {
        method: 'DELETE',
        path: '/members/:id',
        summary: 'ถอดออกจากทีม · ถ้าเป็น PM ต้องย้าย PM ก่อน',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'write',
        rules: [12],
      },
      {
        method: 'PATCH',
        path: '/me',
        summary: 'ชื่อ · ตำแหน่งงาน · ภาษา · การแจ้งเตือน',
        scope: 'tenant',
        milestone: 'M2',
        status: 'live',
        access: 'read',
      },
    ],
  },
  {
    name: 'ลูกค้าและผู้ติดต่อ',
    endpoints: [
      {
        method: 'GET',
        path: '/clients',
        summary: 'รายชื่อลูกค้า + สถานะพอร์ทัล + เรื่องค้าง',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/clients',
        summary: 'เพิ่มลูกค้า',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'PATCH',
        path: '/clients/:id',
        summary: 'แก้ข้อมูลลูกค้า',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/clients/:id/contacts',
        summary: 'ผู้ติดต่อของลูกค้ารายนี้',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/clients/:id/contacts',
        summary: 'เพิ่มผู้ติดต่อ + ส่งลิงก์เข้าใช้ · ฟรี ไม่นับโควตา',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'DELETE',
        path: '/contacts/:id',
        summary: 'เพิกถอนสิทธิ์เข้าพอร์ทัล',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
        rules: [7],
        note: 'ลบผู้ติดต่อ = ปิดการเข้าถึง ไม่ลบเรื่องที่เขาเคยแจ้ง',
      },
    ],
  },
  {
    name: 'แม่แบบ',
    endpoints: [
      {
        method: 'GET',
        path: '/templates',
        summary: 'แม่แบบกลาง + แม่แบบของทีม',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/templates/:id',
        summary: 'ดูโครงเต็มก่อนใช้',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/templates',
        summary: 'สร้างแม่แบบใหม่ · ตั้งคอลัมน์ได้ 2–8 คอลัมน์',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'write',
        rules: [8],
      },
      {
        method: 'POST',
        path: '/templates/from-project/:projectId',
        summary: 'ถอดโปรเจกต์เป็นแม่แบบ · ตัดชื่อคน วันจริง และไฟล์ออก',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'write',
      },
      {
        method: 'PATCH',
        path: '/templates/:id',
        summary: 'แก้แล้วไม่กระทบโปรเจกต์ที่สร้างไปแล้ว',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'write',
        rules: [8],
      },
      {
        method: 'DELETE',
        path: '/templates/:id',
        summary: 'ลบแม่แบบ',
        scope: 'tenant',
        milestone: 'M9',
        status: 'planned',
        access: 'write',
      },
    ],
  },
  {
    name: 'โปรเจกต์',
    endpoints: [
      {
        method: 'GET',
        path: '/projects',
        summary: '?archived=&client=&phase=',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/projects',
        summary: '{ template_id?, key, name, client_id, starts_on, due_on }',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
        rules: [8],
        note: 'คัดลอก board จากแม่แบบตอนสร้าง · ไม่มีแม่แบบ = ชุดมาตรฐาน 4 คอลัมน์',
      },
      {
        method: 'GET',
        path: '/projects/:id',
        summary: 'ข้อมูล + เฟส + สรุปตัวเลข',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'PATCH',
        path: '/projects/:id',
        summary: 'ชื่อ · สี · pm_user_id · board · type_labels · วันที่',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
        rules: [8],
        note: 'เอกสารเดิมเขียน column_labels — ตอนนี้เป็น board (ชื่อ+ลำดับ) แทน',
      },
      {
        method: 'POST',
        path: '/projects/:id/archive',
        summary: 'ปิดโปรเจกต์ · คืนโควตาทันที · ไม่ลบข้อมูล',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'write',
        rules: [7],
      },
      {
        method: 'GET',
        path: '/projects/:id/members',
        summary: 'รายชื่อยกเว้น + แขกที่เข้าถึงได้',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/projects/:id/members',
        summary: '{ user_id | email, access } · PM เชิญแขกเข้าโปรเจกต์ตัวเองได้',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'write',
        rules: [10],
      },
      {
        method: 'PATCH',
        path: '/projects/:id/members/:uid',
        summary: 'เปลี่ยนเป็น read หรือ write',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'write',
        rules: [10],
      },
      {
        method: 'DELETE',
        path: '/projects/:id/members/:uid',
        summary: 'ถอดออกจากโปรเจกต์',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'write',
        rules: [10],
      },
      {
        method: 'PATCH',
        path: '/projects/:id/access',
        summary: '{ member_access: collaborate | read_only }',
        scope: 'tenant',
        milestone: 'M12',
        status: 'planned',
        access: 'write',
        rules: [10],
      },
      {
        method: 'POST',
        path: '/projects/:id/lock-baseline',
        summary: 'บันทึกจำนวนการ์ดตั้งต้น',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'POST',
        path: '/projects/:id/deliver',
        summary: 'กดส่งมอบ → แช่แข็งตัวเลข · เข้าเฟสประกัน · เปิดพอร์ทัล',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/projects/:id/health',
        summary: 'การ์ดที่เพิ่ม · งานนอกแผน · รอบตีกลับ',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
        rules: [9],
      },
      {
        method: 'GET',
        path: '/projects/:id/phases',
        summary: 'เฟสของโปรเจกต์',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/projects/:id/phases',
        summary: 'เพิ่มเฟส',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'POST',
        path: '/projects/:id/phases/:phaseId/enter',
        summary: 'ย้ายโปรเจกต์เข้าเฟสนี้',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/projects/:id/features',
        summary: 'งานหลักของโปรเจกต์',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/projects/:id/features',
        summary: 'เพิ่มงานหลัก',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'PATCH',
        path: '/features/:id',
        summary: 'ชื่อ · สี · ลำดับ · ไม่มีวันที่ให้แก้',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
      {
        method: 'DELETE',
        path: '/features/:id',
        summary: 'การ์ดลูกกลายเป็นงานนอกแผน ไม่ถูกลบ',
        scope: 'tenant',
        milestone: 'M3',
        status: 'live',
        access: 'write',
      },
    ],
  },
  {
    name: 'การ์ดและทิกเก็ต',
    endpoints: [
      {
        method: 'GET',
        path: '/projects/:id/tasks',
        summary: '?feature=&column=&assignee=&type=&origin=&flag=',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'read',
        note: 'เอกสารเดิมเขียน ?status= — เปลี่ยนเป็น ?column= เพราะไม่มี task_status แล้ว',
      },
      {
        method: 'POST',
        path: '/projects/:id/tasks',
        summary: 'เข้าคอลัมน์แรกเสมอ · ไม่รับพารามิเตอร์คอลัมน์',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
        rules: [4, 8],
        note: 'เอกสารเดิมเขียน "เข้าคอลัมน์ todo เสมอ" — ตอนนี้คือ "คอลัมน์แรก" ตามลำดับ',
      },
      {
        method: 'GET',
        path: '/tasks/:id',
        summary: 'พร้อมคอมเมนต์ ไฟล์ และประวัติ',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'read',
      },
      {
        method: 'PATCH',
        path: '/tasks/:id',
        summary: 'ทุกฟิลด์ยกเว้น column_key และ portal_stage · ถ้าปนมาให้ตอบ 400',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
        rules: [4],
        note: 'ตอบ E_COLUMN_NOT_PATCHABLE (400) — เอกสารเดิมเขียนว่า status · ปฏิเสธ portal_stage ด้วยเหตุผลเดียวกัน',
      },
      {
        method: 'POST',
        path: '/tasks/:id/transition',
        summary: 'ประตูเดียวที่การ์ดขยับได้ · ตัดสินจากทิศทางการลาก',
        scope: 'tenant',
        milestone: 'M5',
        status: 'live',
        access: 'write',
        rules: [4, 5, 8],
        note: 'ถอยหลัง = ต้องใส่เหตุผล · เข้าคอลัมน์สุดท้าย = PM เท่านั้น · เขียน task_events พร้อมชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้น',
      },
      {
        method: 'POST',
        path: '/tasks/:id/portal-stage',
        summary: 'ประตูเดียวที่สถานะฝั่งลูกค้าเปลี่ยน · { stage, note? } · ต้องมีคนกดเสมอ ไม่มี auto',
        scope: 'tenant',
        milestone: 'M11',
        status: 'planned',
        access: 'write',
        rules: [5, 6, 10],
        note: 'ไม่มีในเอกสารเดิม · ตัดสิน 20 ส.ค. 2569 · ปุ่ม "รับเรื่อง" เรียกเส้นนี้ด้วย stage=received และรับเป็นเจ้าของถ้ายังว่าง · stage=resolved เฉพาะ PM · เขียน task_events ทุกครั้ง',
      },
      {
        method: 'PATCH',
        path: '/tasks/:id/eta',
        summary: '{ eta } · คำตอบ "จะเสร็จเมื่อไร"',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
      },
      {
        method: 'POST',
        path: '/tasks/:id/triage',
        summary: '{ scope, reason? } · คัดแยกงานประกัน',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/tasks/:id/client-view',
        summary: 'ดูอย่างที่ลูกค้าเห็น — ผ่าน serializer ของพอร์ทัลตัวเดียวกับที่ลูกค้าเรียก',
        scope: 'tenant',
        milestone: 'M11',
        status: 'planned',
        access: 'read',
        rules: [6],
        note: 'ไม่มีในเอกสารเดิม · หน้าจอ 39 · ต้องเรียก serializer ตัวเดียวกับพอร์ทัลจริง ไม่ใช่เขียนซ้ำ ไม่งั้นตัวอย่างจะโกหก',
      },
      {
        method: 'GET',
        path: '/tasks/:id/events',
        summary: 'ประวัติการ์ดทั้งหมด',
        scope: 'tenant',
        milestone: 'M5',
        status: 'live',
        access: 'read',
        rules: [5],
      },
      {
        method: 'DELETE',
        path: '/tasks/:id',
        summary: 'ลบจริง · เฉพาะ PM หรือ owner',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
        note: 'ลบการ์ดได้ แต่ task_events ของการ์ดนั้นลบไม่ได้ (กฎข้อ 5)',
      },
      {
        method: 'GET',
        path: '/tasks/:id/comments',
        summary: 'คอมเมนต์ของการ์ด',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/tasks/:id/comments',
        summary: '{ body, is_internal }',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
        rules: [6],
      },
    ],
  },
  {
    name: 'มุมมองและรายงาน',
    endpoints: [
      {
        method: 'GET',
        path: '/projects/:id/timeline',
        summary: '?by=feature · แท่งคำนวณจากการ์ดลูก',
        scope: 'tenant',
        milestone: 'M7',
        status: 'live',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/activity',
        summary:
          '?range=day|week|month&date=&group=person|project · อ่านจาก task_events + comments ไม่มีตารางใหม่',
        scope: 'tenant',
        milestone: 'M11ข',
        status: 'planned',
        access: 'read',
        rules: [9],
      },
      {
        method: 'POST',
        path: '/tasks/:id/progress',
        summary: '{ body } · บันทึกความคืบหน้า → comments(is_system=false, is_internal=true)',
        scope: 'tenant',
        milestone: 'M11ข',
        status: 'planned',
        access: 'write',
        rules: [6],
      },
      {
        method: 'GET',
        path: '/team/overview',
        summary: '?mode=now · ใครถืออะไร + ถือมากี่วัน + ธง',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
        rules: [9],
      },
      {
        method: 'GET',
        path: '/team/timeline',
        summary: '?from=&to=&grain=day|week|month · ข้ามทุกโปรเจกต์',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/me/tasks',
        summary: 'งานที่ได้รับ จัดกลุ่มตามความเร่งด่วน',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
        note: 'ชื่อขึ้นต้น /me แต่อยู่ในขอบเขต tenant ไม่ใช่รายการกฎข้อ 11',
      },
      {
        method: 'GET',
        path: '/home',
        summary: 'บล็อกของหน้าแรก: รอตัดสินใจ · ต้องรีบ · โปรเจกต์ที่ดูแล',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/calendar',
        summary: '?from=&to=&project=',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/search',
        summary: '?q=&type= · ค้นข้ามทุกโปรเจกต์ · รองรับรหัส ACM-138',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
    ],
  },
  {
    name: 'งานประกันและ SLA',
    endpoints: [
      {
        method: 'GET',
        path: '/sla/overview',
        summary: 'เรื่องค้าง เรียงตามเวลาที่เหลือ',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'read',
        note: 'เรื่องที่ยังไม่มีใครกดรับเรื่องต้องขึ้นก่อนเสมอ เพราะนาฬิกาเดินอยู่แต่ยังไม่มีใครถือ',
      },
      {
        method: 'GET',
        path: '/sla/triage',
        summary: 'คิวที่ warranty_scope = pending',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'GET',
        path: '/sla/clocks/:taskId',
        summary: 'บันทึกช่วงเดิน/หยุดทั้งหมด',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'read',
        note: 'ช่วงแรกของนาฬิกาคือ ลูกค้ากดส่ง → มีคนกดรับเรื่อง (portal_stage=received) ช่วงนี้ยังไม่มีเจ้าของการ์ด',
      },
      {
        method: 'POST',
        path: '/sla/clocks/:taskId/pause',
        summary: '{ kind, reason } · หยุดนาฬิกา',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'write',
      },
      {
        method: 'POST',
        path: '/sla/clocks/:taskId/resume',
        summary: 'เดินนาฬิกาต่อ',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/clients/:id/contract',
        summary: 'สัญญา + นโยบาย SLA ปัจจุบัน',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'PUT',
        path: '/clients/:id/contract',
        summary: 'บันทึกเป็นเวอร์ชันใหม่ ไม่ทับของเดิม',
        scope: 'tenant',
        milestone: 'M10',
        status: 'planned',
        access: 'write',
      },
    ],
  },
  {
    name: 'ไฟล์',
    endpoints: [
      {
        method: 'GET',
        path: '/projects/:id/files',
        summary: 'ไฟล์ทั้งโปรเจกต์',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/attachments/presign',
        summary: '{ filename, mime, size } → URL อัปโหลดตรงไป Spaces',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
        note: 'เอกสารเดิมเขียน R2 — ที่เก็บไฟล์จริงคือ DigitalOcean Spaces',
      },
      {
        method: 'POST',
        path: '/attachments',
        summary: 'บันทึกข้อมูลไฟล์หลังอัปโหลดเสร็จ',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
      },
      {
        method: 'GET',
        path: '/attachments/:id/download',
        summary: 'ลิงก์ชั่วคราวอายุ 5 นาที',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'read',
      },
      {
        method: 'DELETE',
        path: '/attachments/:id',
        summary: 'ลบไฟล์แนบ',
        scope: 'tenant',
        milestone: 'M4',
        status: 'live',
        access: 'write',
      },
    ],
  },
  {
    name: 'การแจ้งเตือน',
    endpoints: [
      {
        method: 'GET',
        path: '/notifications',
        summary: '?unread=1',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
      {
        method: 'POST',
        path: '/notifications/read',
        summary: '{ ids[] } หรือ { all: true }',
        scope: 'tenant',
        milestone: 'M8',
        status: 'planned',
        access: 'read',
      },
    ],
  },
  {
    name: 'พอร์ทัลลูกค้า (คนละชุด คนละการยืนยันตัวตน)',
    endpoints: [
      {
        method: 'POST',
        path: '/portal/request-link',
        summary: '{ email } · ตอบเหมือนกันเสมอ',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6],
      },
      {
        method: 'POST',
        path: '/portal/verify',
        summary: '{ token } → คืน portal session',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6],
        note: 'คุกกี้คนละชื่อ คนละ secret · ต้องปฏิเสธ session ของฝั่งทีม',
      },
      {
        method: 'GET',
        path: '/portal/issues',
        summary: 'เรื่องของผู้ติดต่อคนนี้เท่านั้น',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6],
      },
      {
        method: 'POST',
        path: '/portal/issues',
        summary: '{ title, description, reported_impact, files[] }',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6],
        note: 'ตัดสิน 20 ส.ค. 2569 — นาฬิกา SLA เริ่มเดิน ณ วินาทีที่ลูกค้ากดส่ง ไม่ใช่ตอนเจ้าหน้าที่กดรับเรื่อง · เวลาที่เรื่องนอนรออยู่จึงถูกนับ · เดินตามเวลาทำการใน tenants.business_hours',
      },
      {
        method: 'GET',
        path: '/portal/issues/:code',
        summary: 'สถานะ + วันที่ + ไทม์ไลน์ 5 ขั้นที่เจ้าหน้าที่กดเอง',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6, 8],
        note: 'ตัดสินแล้ว 20 ส.ค. 2569 — 5 ขั้นตามต้นแบบ อ่านจาก tasks.portal_stage ที่คนกดเอง ไม่แปลงจากคอลัมน์ · ยังไม่มีใครรับเรื่อง = ตอบว่า "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"',
      },
      {
        method: 'POST',
        path: '/portal/attachments/presign',
        summary: 'จำกัดชนิดไฟล์เข้มกว่าฝั่งทีม',
        scope: 'portal',
        milestone: 'M11',
        status: 'planned',
        rules: [6],
      },
    ],
  },
  {
    name: 'ระบบ (ใช้ภายใน ไม่แตะข้อมูลผู้ใช้)',
    endpoints: [
      {
        method: 'GET',
        path: '/meta/health',
        summary: 'เครื่องยังตอบอยู่ไหม + หน่วยความจำ + เวลาที่รันมา',
        scope: 'meta',
        milestone: '—',
        status: 'live',
      },
      {
        method: 'GET',
        path: '/meta/endpoints',
        summary: 'ทะเบียนนี้ทั้งชุดเป็น JSON + ผลตรวจกฎ',
        scope: 'meta',
        milestone: '—',
        status: 'live',
      },
      {
        method: 'GET',
        path: '/meta/openapi',
        summary: 'สเปค OpenAPI 3.1 สร้างจากทะเบียน · นำเข้า Postman/Insomnia/Bruno ได้ตรงๆ',
        scope: 'meta',
        milestone: '—',
        status: 'live',
      },
    ],
  },
];

export const ALL_ENDPOINTS: Endpoint[] = GROUPS.flatMap((g) => g.endpoints);

export function endpointKey(e: Pick<Endpoint, 'method' | 'path'>): string {
  return `${e.method} ${e.path}`;
}

export interface StatusCount {
  live: number;
  partial: number;
  planned: number;
  total: number;
}

export function countByStatus(endpoints: Endpoint[] = ALL_ENDPOINTS): StatusCount {
  const c: StatusCount = { live: 0, partial: 0, planned: 0, total: endpoints.length };
  for (const e of endpoints) c[e.status] += 1;
  return c;
}

/** นับตามหมุดหมาย เรียงตามลำดับที่ประกาศไว้ ไม่ใช่เรียงตามตัวอักษร */
export function countByMilestone(): { milestone: Milestone; count: StatusCount }[] {
  const order: Milestone[] = [
    'M2',
    'M3',
    'M4',
    'M5',
    'M6',
    'M7',
    'M8',
    'M9',
    'M10',
    'M11',
    'M11ข',
    'M12',
    '—',
  ];
  return order
    .map((m) => ({
      milestone: m,
      count: countByStatus(ALL_ENDPOINTS.filter((e) => e.milestone === m)),
    }))
    .filter((r) => r.count.total > 0);
}
