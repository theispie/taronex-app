/**
 * แม่แบบโปรเจกต์ — M9
 *
 * ═══ เก็บทั้งชุดเป็น JSON ก้อนเดียว ไม่มีตารางลูก ═══
 * แม่แบบไม่ใช่ข้อมูลที่ต้อง query เข้าไปข้างใน มันถูกอ่านทั้งก้อนตอนสร้างโปรเจกต์
 * แล้วก็ไม่ถูกแตะอีกเลย การทำตารางลูกจึงเพิ่ม join โดยไม่ได้อะไรกลับมา
 *
 * ═══ แก้แม่แบบต้องไม่กระทบโปรเจกต์ที่สร้างไปแล้ว ═══
 * ตอนสร้างโปรเจกต์เรา **คัดลอก** ค่าออกมาเป็นแถวจริง ไม่ได้อ้างอิงกลับไปที่แม่แบบ
 * โปรเจกต์จึงไม่มีทางเปลี่ยนตามแม่แบบ ไม่ว่าใครจะแก้แม่แบบทีหลังยังไง
 */

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { features, projectPhases, projects, projectTemplates, tasks } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { validateColumns } from '@/lib/types';

export interface TemplateTask {
  title: string;
  /** ช่องประเภทงาน a/b/c · ป้ายจริงอยู่ที่ typeLabels */
  type?: 'a' | 'b' | 'c';
  /** วันสัมพัทธ์จากวันเริ่มโปรเจกต์ — แปลงเป็นวันจริงตอนสร้าง */
  offsetDays?: number;
  durationDays?: number;
}

export interface TemplateFeature {
  name: string;
  color?: string;
  tasks: TemplateTask[];
}

export interface TemplateDefinition {
  /** ชุดคอลัมน์ · แทนที่ column_labels เดิม (กฎข้อ 8) */
  board: { key: string; name: string }[];
  typeLabels: Record<string, string>;
  phases: { name: string; kind?: 'normal' | 'delivery' | 'warranty' }[];
  features: TemplateFeature[];
}

const DEFAULT_BOARD = [
  { key: 'todo', name: 'รอเริ่ม' },
  { key: 'doing', name: 'กำลังทำ' },
  { key: 'review', name: 'รอตรวจ' },
  { key: 'done', name: 'เสร็จ' },
];

/** ตรวจโครงของแม่แบบก่อนบันทึก — ผิดตรงนี้ดีกว่าไปพังตอนสร้างโปรเจกต์ */
export function validateDefinition(d: unknown): TemplateDefinition {
  const def = d as Partial<TemplateDefinition>;
  const board = Array.isArray(def?.board) && def.board.length > 0 ? def.board : DEFAULT_BOARD;

  const problems = validateColumns(board);
  if (problems.length > 0) throw new ApiError('E_COLUMN_COUNT', problems.join(' · '), 'board');

  const typeLabels = def?.typeLabels ?? { a: 'งาน', b: 'บั๊ก', c: 'เอกสาร' };
  // ป้ายประเภทงานมีได้สูงสุด 3 ค่า เพราะช่องมีแค่ a/b/c
  const keys = Object.keys(typeLabels).filter((k) => ['a', 'b', 'c'].includes(k));
  if (keys.length === 0 || keys.length > 3) {
    throw new ApiError('E_INVALID', 'ป้ายประเภทงานต้องมี 1–3 ค่า (a · b · c)', 'typeLabels');
  }

  const phases = Array.isArray(def?.phases) ? def.phases : [];
  const feats = Array.isArray(def?.features) ? def.features : [];
  for (const f of feats) {
    if (!f?.name?.trim()) throw new ApiError('E_INVALID', 'งานหลักต้องมีชื่อ', 'features');
    if (!Array.isArray(f.tasks)) f.tasks = [];
  }

  return { board, typeLabels, phases, features: feats };
}

// ─────────────────────────── อ่าน ───────────────────────────

/**
 * แม่แบบของทีมมาก่อนแม่แบบกลางเสมอ
 * กระบวนการของเอเจนซี่เองมีค่ากว่าแม่แบบสำเร็จรูป
 */
export async function listTemplates(tx: Tx, tenantId: string) {
  const rows = await tx
    .select({
      id: projectTemplates.id,
      tenantId: projectTemplates.tenantId,
      name: projectTemplates.name,
      description: projectTemplates.description,
      definition: projectTemplates.definition,
      useCount: projectTemplates.useCount,
    })
    .from(projectTemplates)
    .where(or(eq(projectTemplates.tenantId, tenantId), isNull(projectTemplates.tenantId)))
    .orderBy(asc(projectTemplates.name));

  return rows.map((r) => {
    const d = r.definition as TemplateDefinition;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      /** null = แม่แบบกลางของระบบ · แก้ไม่ได้จากฝั่งแอป */
      isCentral: r.tenantId === null,
      useCount: r.useCount,
      columns: (d.board ?? []).map((c) => c.name),
      types: Object.values(d.typeLabels ?? {}),
      features: (d.features ?? []).map((f) => f.name),
      taskCount: (d.features ?? []).reduce((n, f) => n + (f.tasks?.length ?? 0), 0),
      phaseCount: (d.phases ?? []).length,
    };
  });
}

export async function getTemplate(tx: Tx, templateId: string) {
  const rows = await tx
    .select({
      id: projectTemplates.id,
      tenantId: projectTemplates.tenantId,
      name: projectTemplates.name,
      description: projectTemplates.description,
      definition: projectTemplates.definition,
      useCount: projectTemplates.useCount,
    })
    .from(projectTemplates)
    .where(eq(projectTemplates.id, templateId))
    .limit(1);
  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');
  return {
    ...t,
    isCentral: t.tenantId === null,
    definition: t.definition as TemplateDefinition,
  };
}

// ─────────────────────────── เขียน ───────────────────────────

export async function createTemplate(
  tx: Tx,
  tenantId: string,
  input: { name: string; description?: string; definition: unknown },
) {
  const name = input.name.trim();
  if (!name) throw new ApiError('E_INVALID', 'ต้องมีชื่อแม่แบบ', 'name');
  const definition = validateDefinition(input.definition);

  const rows = await tx
    .insert(projectTemplates)
    .values({ tenantId, name, description: input.description?.trim() ?? '', definition })
    .returning({ id: projectTemplates.id });
  return rows[0];
}

/** แม่แบบกลางแก้ไม่ได้จากฝั่งแอป — RLS ก็ปฏิเสธอยู่แล้ว แต่ตอบให้สวยกว่าถ้าเช็คก่อน */
async function assertOwned(tx: Tx, templateId: string, tenantId: string) {
  const t = await getTemplate(tx, templateId);
  if (t.tenantId !== tenantId) {
    throw new ApiError('E_FORBIDDEN', 'แม่แบบกลางแก้ไม่ได้ · คัดลอกไปเป็นของทีมก่อน');
  }
  return t;
}

export async function updateTemplate(
  tx: Tx,
  tenantId: string,
  templateId: string,
  patch: { name?: string; description?: string; definition?: unknown },
) {
  await assertOwned(tx, templateId, tenantId);
  const set: Record<string, unknown> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.description !== undefined) set.description = patch.description.trim();
  if (patch.definition !== undefined) set.definition = validateDefinition(patch.definition);
  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

  await tx.update(projectTemplates).set(set).where(eq(projectTemplates.id, templateId));
}

export async function deleteTemplate(tx: Tx, tenantId: string, templateId: string) {
  await assertOwned(tx, templateId, tenantId);
  await tx.delete(projectTemplates).where(eq(projectTemplates.id, templateId));
}

/**
 * ถอดโปรเจกต์เป็นแม่แบบ
 *
 * **ตัดชื่อคน วันจริง และไฟล์ออกทั้งหมด**
 * ชื่อคนติดไปด้วยแล้วจะมอบหมายให้คนที่ลาออกไปแล้ว
 * วันจริงติดไปด้วยแล้วโปรเจกต์ใหม่จะได้กำหนดส่งของโปรเจกต์เก่า
 * เก็บเป็นวันสัมพัทธ์จากวันเริ่มแทน จึงใช้ซ้ำได้ทุกโปรเจกต์
 */
export async function templateFromProject(
  tx: Tx,
  tenantId: string,
  projectId: string,
  name: string,
) {
  const rows = await tx
    .select({
      id: projects.id,
      name: projects.name,
      board: projects.board,
      typeLabels: projects.typeLabels,
      startsOn: projects.startsOn,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const start = Date.parse(`${p.startsOn}T00:00:00Z`);
  const dayOf = (d: string | null) =>
    d ? Math.round((Date.parse(`${d}T00:00:00Z`) - start) / 86_400_000) : undefined;

  const ph = await tx
    .select({ name: projectPhases.name, kind: projectPhases.kind })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.position));

  const fs = await tx
    .select({ id: features.id, name: features.name, color: features.color })
    .from(features)
    .where(eq(features.projectId, projectId))
    .orderBy(asc(features.position));

  const ts = await tx
    .select({
      featureId: tasks.featureId,
      title: tasks.title,
      typeSlot: tasks.typeSlot,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.origin, 'delivery')))
    .orderBy(asc(tasks.number));

  const definition: TemplateDefinition = {
    board: p.board as TemplateDefinition['board'],
    typeLabels: p.typeLabels as Record<string, string>,
    phases: ph.map((x) => ({ name: x.name, kind: x.kind })),
    features: fs.map((f) => ({
      name: f.name,
      color: f.color,
      tasks: ts
        .filter((t) => t.featureId === f.id)
        .map((t) => {
          const off = dayOf(t.startDate ?? t.dueDate);
          const end = dayOf(t.dueDate);
          return {
            title: t.title,
            type: t.typeSlot,
            offsetDays: off,
            durationDays:
              off !== undefined && end !== undefined ? Math.max(0, end - off) : undefined,
          };
        }),
    })),
  };

  const created = await tx
    .insert(projectTemplates)
    .values({
      tenantId,
      name: name.trim() || `${p.name} (แม่แบบ)`,
      description: `ถอดจากโปรเจกต์ ${p.name}`,
      definition,
      createdFromProjectId: p.id,
    })
    .returning({ id: projectTemplates.id });
  return created[0];
}

// ─────────────────────────── ใช้แม่แบบสร้างโปรเจกต์ ───────────────────────────

export interface ApplyResult {
  phases: number;
  features: number;
  tasks: number;
  baselineTaskCount: number;
}

/**
 * แตกแม่แบบเป็นแถวจริงในโปรเจกต์ที่เพิ่งสร้าง
 *
 * ═══ คัดลอกออกมา ไม่ใช่อ้างอิงกลับไป ═══
 * นี่คือเหตุผลที่แก้แม่แบบทีหลังแล้วโปรเจกต์เก่าไม่เปลี่ยน
 *
 * ═══ แปลงวันสัมพัทธ์เป็นวันจริง ═══
 * แม่แบบเก็บ offsetDays จากวันเริ่ม จึงใช้ซ้ำได้ทุกโปรเจกต์ไม่ว่าเริ่มวันไหน
 *
 * ═══ ตั้ง baseline ทันที ═══
 * จำนวนการ์ดตั้งต้นคือจำนวนที่แม่แบบให้มา บันทึกไว้เลยตั้งแต่วันแรก
 * ไม่งั้นถ้ารอให้คนมากดทีหลัง จะไม่มีใครกด แล้วตัวเลข "ขอบเขตบานปลาย" จะใช้ไม่ได้ทั้งระบบ
 */
export async function applyTemplate(
  tx: Tx,
  tenantId: string,
  projectId: string,
  templateId: string,
  actorId: string,
): Promise<ApplyResult> {
  const t = await getTemplate(tx, templateId);
  const def = validateDefinition(t.definition);

  const rows = await tx
    .select({ startsOn: projects.startsOn, key: projects.key })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new ApiError('E_NOT_FOUND');

  const start = Date.parse(`${p.startsOn}T00:00:00Z`);
  const dateAt = (days: number) => new Date(start + days * 86_400_000).toISOString().slice(0, 10);

  // บอร์ดกับป้ายประเภทงานมาจากแม่แบบ
  await tx
    .update(projects)
    .set({ board: def.board, typeLabels: def.typeLabels })
    .where(eq(projects.id, projectId));

  // เฟส — เฟสแรกเป็นเฟสปัจจุบัน
  let firstPhaseId: string | null = null;
  for (const [i, ph] of def.phases.entries()) {
    const ins = await tx
      .insert(projectPhases)
      .values({
        tenantId,
        projectId,
        name: ph.name,
        kind: ph.kind ?? 'normal',
        position: i + 1,
        startedAt: i === 0 ? new Date() : null,
      })
      .returning({ id: projectPhases.id });
    if (i === 0) firstPhaseId = ins[0]?.id ?? null;
  }
  if (firstPhaseId) {
    await tx
      .update(projects)
      .set({ currentPhaseId: firstPhaseId })
      .where(eq(projects.id, projectId));
  }

  // งานหลักและการ์ด
  const firstColumn = def.board[0];
  if (!firstColumn) throw new ApiError('E_UNPROCESSABLE', 'แม่แบบไม่มีคอลัมน์');

  let number = 1;
  let taskCount = 0;
  for (const [i, f] of def.features.entries()) {
    const ins = await tx
      .insert(features)
      .values({
        tenantId,
        projectId,
        name: f.name,
        color: f.color ?? '#5B5BD6',
        position: i + 1,
      })
      .returning({ id: features.id });
    const featureId = ins[0]?.id;

    for (const [j, task] of (f.tasks ?? []).entries()) {
      const off = task.offsetDays ?? 0;
      const dur = task.durationDays ?? 0;
      await tx.insert(tasks).values({
        tenantId,
        projectId,
        featureId,
        number,
        title: task.title,
        // การ์ดจากแม่แบบลงคอลัมน์แรกเสมอ เหมือนการ์ดที่คนสร้างเอง (กฎข้อ 8)
        columnKey: firstColumn.key,
        typeSlot: task.type ?? 'a',
        startDate: dateAt(off),
        dueDate: dateAt(off + dur),
        position: j + 1,
        createdBy: actorId,
      });
      number += 1;
      taskCount += 1;
    }
  }

  // ตัวนับเลขการ์ดต้องเดินต่อจากที่แม่แบบใช้ไป ไม่งั้นการ์ดใบถัดไปจะเลขซ้ำ
  await tx.update(projects).set({ nextTaskNumber: number }).where(eq(projects.id, projectId));

  // บันทึกจำนวนการ์ดตั้งต้นทันที — ไม่รอให้คนมากดทีหลัง
  await tx
    .update(projects)
    .set({ baselineTaskCount: taskCount, baselineLockedAt: new Date() })
    .where(eq(projects.id, projectId));

  /**
   * นับจำนวนครั้งที่ใช้ — เฉพาะแม่แบบของทีมเท่านั้น
   *
   * แม่แบบกลางเป็นแถวที่ทุกที่ทำงานใช้ร่วมกัน การเพิ่มตัวนับจึงเป็น**การเขียนข้ามที่ทำงาน**
   * RLS ปฏิเสธถูกแล้ว และถึงเปิดให้เขียนได้ก็ไม่ควรทำ เพราะ
   *   หนึ่ง — ที่ทำงานหนึ่งจะเดาได้ว่าที่ทำงานอื่นใช้แม่แบบไหนบ่อย
   *   สอง — ทุกที่ทำงานเขียนแถวเดียวกัน กลายเป็นจุดที่แย่งล็อกกัน
   * ถ้าวันหนึ่งอยากรู้สถิติของแม่แบบกลางจริง ให้เก็บแยกเป็นตารางของระบบ
   */
  if (!t.isCentral) {
    await tx
      .update(projectTemplates)
      .set({ useCount: sql`${projectTemplates.useCount} + 1` })
      .where(eq(projectTemplates.id, templateId));
  }

  return {
    phases: def.phases.length,
    features: def.features.length,
    tasks: taskCount,
    baselineTaskCount: taskCount,
  };
}
