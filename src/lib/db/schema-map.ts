/**
 * ผังฐานข้อมูล — อ่านจาก `src/db/schema.ts` โดยตรง ไม่ได้พิมพ์ซ้ำ
 *
 * ═══ ทำไมต้องอ่านจากของจริง ═══
 * เอกสารผังฐานข้อมูลที่พิมพ์มือจะเก่าภายในสองสัปดาห์เสมอ แล้วจะแย่กว่าไม่มี
 * เพราะคนอ่านจะเชื่อมัน · ชื่อตาราง ชื่อคอลัมน์ ชนิด ค่าว่างได้ไหม กุญแจนอก ดัชนี
 * ทั้งหมดดึงจาก Drizzle ตอนรัน ผังจึงตรงกับของจริงเสมอโดยไม่ต้องมีใครมาอัปเดต
 *
 * ═══ สิ่งเดียวที่พิมพ์มือคือ "ทำไม" ═══
 * เครื่องบอกได้ว่าคอลัมน์นี้เป็น `text NOT NULL` แต่บอกไม่ได้ว่าทำไมถึงไม่มี `task_status`
 * บันทึกเหตุผลจึงอยู่ใน `TABLE_NOTES` / `COLUMN_NOTES` ข้างล่าง
 * และมีเทสต์ตรวจว่าทุกกุญแจในสองแมปนั้นชี้ไปที่ตาราง/คอลัมน์ที่มีอยู่จริง
 * ถ้าใครเปลี่ยนชื่อคอลัมน์แล้วลืมแก้บันทึก เทสต์จะพังทันที ไม่ปล่อยให้เน่าเงียบๆ
 */

import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  hasDefault: boolean;
  primary: boolean;
  unique: boolean;
  /** ชี้ไปตารางไหน · null = ไม่ใช่กุญแจนอก */
  references: { table: string; column: string; onDelete: string | null } | null;
  note: string | null;
}

export interface TableInfo {
  name: string;
  group: string;
  columns: ColumnInfo[];
  indexes: string[];
  uniques: string[];
  /** ตารางนี้มี tenant_id ไหม — ตัวชี้ว่าต้องมี RLS หรือไม่ */
  hasTenantId: boolean;
  note: string | null;
}

/** จัดกลุ่มให้อ่านง่าย — ลำดับเดียวกับที่ไล่อ่านในหัวตอนออกแบบ */
const GROUPS: { name: string; tables: string[] }[] = [
  { name: 'ตัวตนและที่ทำงาน', tables: ['tenants', 'users', 'memberships', 'invitations', 'sessions'] },
  { name: 'ลูกค้า', tables: ['clients', 'client_contacts'] },
  {
    name: 'โปรเจกต์',
    tables: ['projects', 'project_phases', 'project_members', 'project_templates', 'features'],
  },
  {
    name: 'การ์ดและประวัติ',
    tables: ['tasks', 'task_events', 'comments', 'attachments', 'time_entries'],
  },
  {
    name: 'งานประกันและ SLA',
    tables: [
      'warranty_contracts',
      'sla_policies',
      'sla_policy_levels',
      'sla_clocks',
      'sla_clock_events',
    ],
  },
  { name: 'พอร์ทัลและแจ้งเตือน', tables: ['portal_tokens', 'notifications'] },
];

/** ═══ บันทึกที่พิมพ์มือ — "ทำไม" ที่เครื่องบอกไม่ได้ ═══ */
const TABLE_NOTES: Record<string, string> = {
  tenants:
    '⚠ ตารางเดียวในระบบที่**ไม่มี RLS** เพราะไม่มีคอลัมน์ tenant_id ให้ policy ยึด — ทุก query ที่แตะตารางนี้ต้องมี WHERE id เสมอ (เคยลืมแล้วได้แผนของที่ทำงานอื่นมาใช้จริง)',
  users:
    'ไม่มี RLS เช่นกัน — คนหนึ่งคนอยู่ได้หลายที่ทำงาน เข้าถึงผ่าน memberships เสมอ · ปิดใช้งานแทนการลบ เพราะ task_events ต้องชี้ตัวตนเดิมได้ตลอด',
  sessions:
    'ไม่มี RLS — ผูกกับ*คน* ไม่ใช่กับที่ทำงาน เพราะคนหนึ่งอยู่ได้หลายที่ทำงาน ถ้าผูกกับที่ทำงานจะต้องล็อกอินใหม่ทุกครั้งที่สลับ · เก็บเฉพาะ hash ของโทเคน ฐานรั่วแล้วโทเคนที่ยังไม่หมดอายุก็ใช้ไม่ได้',
  memberships: 'บทบาทอยู่ที่นี่ ไม่ได้อยู่ที่ users เพราะคนเดียวกันเป็นเจ้าของที่หนึ่งและเป็นแขกอีกที่ได้',
  projects: 'ไม่มีเส้นทางลบในทั้งระบบ · ปิดได้อย่างเดียว (is_archived) แล้วคืนโควตาทันทีโดยข้อมูลอยู่ครบ (กฎข้อ 7)',
  tasks: '⭐ **ไม่มี task_status** ตัดทิ้งโดยตั้งใจ · สถานะคือ "อยู่คอลัมน์ไหนบนบอร์ด" ซึ่งคือ column_key ตัวเดียว',
  task_events:
    '⭐ **เขียนอย่างเดียว** REVOKE UPDATE, DELETE จาก role app (กฎข้อ 5) · เก็บชื่อและตำแหน่งคอลัมน์ ณ ตอนนั้นด้วย เพราะบอร์ดเปลี่ยนได้แต่ประวัติต้องอ่านย้อนหลังได้',
  comments: 'is_internal ค่าเริ่มต้นเป็น true — พลาดทางนี้ปลอดภัยกว่า (กฎข้อ 6)',
  sla_clocks:
    '⭐ คัดลอกเวลาเป้าหมายมาเก็บตอนสร้าง ไม่ join กลับไปที่นโยบายตอนอ่าน — นี่คือกลไกเดียวที่ทำให้ "เปลี่ยนนโยบายแล้วเรื่องเก่าใช้ค่าเดิม" เป็นจริง',
  sla_clock_events:
    '⭐ **ไม่มีคอลัมน์ยอดสะสม** เวลาที่ใช้ไปคำนวณสดจากช่วงเดิน/หยุดทุกครั้ง ถ้าเก็บยอดไว้ วันหนึ่งจะมีคนแก้แล้วพิสูจน์ย้อนหลังไม่ได้',
  sla_policies: 'เก็บเป็นเวอร์ชัน ไม่ทับของเดิม · แก้แล้วไม่กระทบเรื่องที่เปิดนาฬิกาไปแล้ว',
  portal_tokens:
    'ลิงก์เข้าใช้งาน**ครั้งเดียว** อายุ 24 ชม. · ไม่ใช่เซสชัน (เซสชันพอร์ทัลเป็นคุกกี้ที่เซ็นไว้ ไม่เก็บลงตาราง)',
  project_members:
    'ตารางเดียว สองหน้าที่ — เป็นทั้ง "รายชื่อยกเว้น" ของสมาชิก และ "ใบผ่าน" ของแขกที่ไม่มีสิทธิ์เห็นอะไรเลยถ้าไม่มีแถวนี้',
  notifications: 'ส่งอีเมลจริงแค่ 3 ชนิด · ตอนนี้**ยังไม่มีอะไรเขียนลงตารางนี้** เพราะยังไม่ได้ต่อบริการส่งอีเมล',
  project_templates: 'แม่แบบกลาง 8 ชุดใช้ร่วมกันทุกที่ทำงาน (tenant_id ว่าง) · ที่ทำงานสร้างของตัวเองเพิ่มได้',
};

const COLUMN_NOTES: Record<string, string> = {
  'projects.board':
    '⭐ [{key,name}] 2–8 คอลัมน์ · คอลัมน์มีแค่ชื่อกับลำดับ **ห้ามเพิ่มฟิลด์ตั้งค่าใดๆ** ไม่มีธง ไม่มี is_done ไม่มี maps_to (กฎข้อ 8) · จำนวนบังคับด้วย CHECK ที่ฐานข้อมูล',
  'projects.portal_enabled': 'คำนวณจากเฟส ตั้งเองตรงๆ ไม่ได้ · เข้าเฟสชนิด warranty แล้วเปิดเอง',
  'projects.is_archived': 'โควตานับเฉพาะ false · ปิดแล้วคืนโควตาทันที ข้อมูลไม่หาย',
  'projects.health_snapshot':
    'ตัวเลขช่วงส่งมอบที่ถูกแช่แข็ง — หลังส่งมอบการ์ดประกันจะไหลเข้ามาเรื่อยๆ ตัวเลขสดจะไม่ตอบคำถามว่า "ตอนส่งมอบเป็นยังไง" อีก',
  'tasks.column_key':
    '⭐ เปลี่ยนได้ทาง POST /tasks/:id/transition **เท่านั้น** (กฎข้อ 4) · บังคับด้วย trigger guard_task_column ที่ฐานข้อมูล ไม่ใช่แค่โค้ดฝั่งแอป',
  'tasks.portal_stage':
    '⭐ สถานะที่ลูกค้าเห็น · **ต้องมีคนกดเสมอ ไม่คำนวณจากบอร์ด ไม่มี auto** (ตัดสิน 20 ส.ค. 2569) · ว่าง = ยังไม่มีเจ้าหน้าที่รับเรื่อง',
  'tasks.reported_impact': 'ระดับที่**ลูกค้า**เลือก เก็บแยกจาก priority ที่ทีมตั้ง — คนละความเห็น ไม่ควรทับกัน',
  'tasks.warranty_scope': 'ผลคัดแยกว่าอยู่ในประกันหรือไม่ · เจ้าหน้าที่กดเท่านั้น ระบบไม่เดาให้',
  'tasks.number':
    'เลขในรหัสการ์ด (ACM-138) · เพิ่มด้วย UPDATE…RETURNING ในธุรกรรมเดียว ไม่ใช่อ่านมาบวกหนึ่ง ไม่งั้นสองคนกดพร้อมกันจะได้เลขชนกัน',
  'task_events.task_id':
    'ว่างได้เมื่อการ์ดถูกลบจริง (ON DELETE SET NULL) · ถ้าเป็น NOT NULL จะลบการ์ดไม่ได้เลยสักใบ เพราะ role app ถูก REVOKE UPDATE บนตารางนี้',
  'task_events.from_column_index':
    'ตำแหน่ง ณ ตอนนั้น — ใช้ตัดสินย้อนหลังว่าครั้งนั้นเป็นการเดินหน้าหรือตีกลับ · ไม่ join กลับไปที่ projects.board เพราะบอร์ดเปลี่ยนได้',
  'task_events.column_count': 'จำนวนคอลัมน์ทั้งหมด ณ ตอนนั้น — ไม่งั้นบอกไม่ได้ว่าตอนนั้นเป็นคอลัมน์สุดท้ายหรือไม่',
  'tenants.slug':
    'รหัสใน URL /app/<code> · **ไม่ใช่ความลับและไม่ใช่สิทธิ์** ทุก request ตรวจ memberships ซ้ำเสมอ',
  'tenants.business_hours': 'นาฬิกา SLA เดินเฉพาะเวลาทำการนี้ · กดส่งตี 2 วันเสาร์แล้วนาฬิกาไม่วิ่งรวด',
  'memberships.job_title': 'แสดงผลและกรองเท่านั้น **ไม่ผูกกับสิทธิ์แม้แต่ครั้งเดียวในทั้งระบบ**',
  'sessions.token_hash': 'เก็บ hash (SHA-256) ไม่เก็บโทเคนดิบ',
  'client_contacts.can_see_all': 'true = เห็นทุกเรื่องของบริษัทตัวเอง · ปกติเห็นเฉพาะที่ตัวเองแจ้ง',
  'attachments.storage_provider': 'ตอนนี้ยังชี้ MinIO บนเครื่อง — ยังไม่ได้ต่อที่เก็บไฟล์ของจริง',
  'sla_clocks.target_resolve_minutes': 'คัดลอกมาจากนโยบาย ณ วันที่เปิดนาฬิกา · ไม่ขยับตามนโยบายใหม่',
};

function tableGroup(name: string): string {
  return GROUPS.find((g) => g.tables.includes(name))?.name ?? 'อื่นๆ';
}

/** อ่านผังทั้งหมดจาก Drizzle · เรียงตามกลุ่มที่ประกาศไว้ข้างบน */
export function readSchema(): TableInfo[] {
  const out: TableInfo[] = [];

  for (const value of Object.values(schema)) {
    let cfg: ReturnType<typeof getTableConfig>;
    try {
      cfg = getTableConfig(value as Parameters<typeof getTableConfig>[0]);
    } catch {
      continue; // ไม่ใช่ตาราง (enum · relation · ตัวช่วย)
    }

    const fkByColumn = new Map<string, ColumnInfo['references']>();
    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const from = ref.columns[0];
      const to = ref.foreignColumns[0];
      if (!from || !to) continue;
      fkByColumn.set(from.name, {
        table: getTableConfig(ref.foreignTable).name,
        column: to.name,
        onDelete: fk.onDelete ?? null,
      });
    }

    out.push({
      name: cfg.name,
      group: tableGroup(cfg.name),
      hasTenantId: cfg.columns.some((c) => c.name === 'tenant_id'),
      note: TABLE_NOTES[cfg.name] ?? null,
      indexes: cfg.indexes.map((i) => i.config.name ?? '—'),
      uniques: cfg.uniqueConstraints.map((u) => u.name ?? '—'),
      columns: cfg.columns.map((c) => ({
        name: c.name,
        type: c.getSQLType(),
        notNull: c.notNull,
        hasDefault: c.hasDefault,
        primary: c.primary,
        unique: c.isUnique,
        references: fkByColumn.get(c.name) ?? null,
        note: COLUMN_NOTES[`${cfg.name}.${c.name}`] ?? null,
      })),
    });
  }

  const order = GROUPS.flatMap((g) => g.tables);
  return out.sort((a, b) => {
    const ai = order.indexOf(a.name);
    const bi = order.indexOf(b.name);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

export const GROUP_ORDER = GROUPS.map((g) => g.name);
export { COLUMN_NOTES, TABLE_NOTES };
