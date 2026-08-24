/**
 * ทางเข้าพอร์ทัลลูกค้า และการรับเรื่องใหม่
 *
 * ═══ ไม่ใช้รหัสผ่าน ═══
 * คนของลูกค้าเข้าปีละไม่กี่ครั้ง ตั้งรหัสไปก็ลืม แล้วจะโทรหาทีมให้รีเซ็ตให้
 * ลิงก์ครั้งเดียวอายุ 24 ชม. จบเรื่องนั้นทั้งหมด
 *
 * ═══ ตอบเหมือนกันเสมอ ═══
 * `requestLink()` คืน token เมื่อพบอีเมล และคืน null เมื่อไม่พบ
 * **ตัวเรียกต้องตอบข้อความเดียวกันทั้งสองกรณี** ไม่งั้นพอร์ทัลจะกลายเป็นเครื่องมือ
 * ตรวจว่าอีเมลไหนเป็นลูกค้าของเอเจนซี่รายนี้ ซึ่งเป็นข้อมูลทางธุรกิจของลูกค้าเรา
 */

import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { clientContacts, portalTokens, projects, tasks } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { expiresIn, generateToken, HOUR, hashToken, PORTAL_TTL_HOURS } from '@/lib/auth/tokens';
import { createTask } from '@/lib/tasks';
import type { PortalContact } from './session';

/** อีเมลเทียบแบบตัวพิมพ์เล็กเสมอ — ลูกค้าพิมพ์มาแบบไหนก็ได้ */
function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export async function requestLink(
  tx: Tx,
  tenantId: string,
  emailRaw: string,
): Promise<{ token: string; contactId: string; name: string } | null> {
  const email = normalize(emailRaw);
  if (!email.includes('@')) return null;

  const rows = await tx
    .select({ id: clientContacts.id, name: clientContacts.name })
    .from(clientContacts)
    .where(and(eq(clientContacts.tenantId, tenantId), eq(clientContacts.email, email)))
    .limit(1);
  const c = rows[0];
  if (!c) return null;

  const token = generateToken();
  await tx.insert(portalTokens).values({
    tenantId,
    contactId: c.id,
    tokenHash: hashToken(token),
    expiresAt: expiresIn(PORTAL_TTL_HOURS * HOUR),
  });
  return { token, contactId: c.id, name: c.name };
}

/**
 * แลกโทเคนเป็นเซสชัน · **ใช้ได้ครั้งเดียว**
 *
 * ทำเป็น UPDATE แบบมีเงื่อนไขในคำสั่งเดียว ไม่ใช่ SELECT แล้วค่อย UPDATE
 * ไม่งั้นสองคำขอที่มาพร้อมกันด้วยโทเคนใบเดียวกันจะผ่านทั้งคู่
 */
export async function verifyLink(tx: Tx, tenantId: string, token: string): Promise<string> {
  const rows = await tx
    .update(portalTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(portalTokens.tokenHash, hashToken(token)),
        eq(portalTokens.tenantId, tenantId),
        isNull(portalTokens.usedAt),
        gt(portalTokens.expiresAt, new Date()),
      ),
    )
    .returning({ contactId: portalTokens.contactId });

  const hit = rows[0];
  if (!hit) throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้ใช้ไปแล้วหรือหมดอายุ กรุณาขอใหม่');
  return hit.contactId;
}

export interface NewIssue {
  title: string;
  description?: string;
  reportedImpact?: 'blocking' | 'degraded' | 'minor';
  /** ระบุโปรเจกต์เมื่อลูกค้ามีหลายโปรเจกต์ที่เปิดพอร์ทัลอยู่ */
  projectId?: string;
}

/** โปรเจกต์ของลูกค้ารายนี้ที่เปิดพอร์ทัลแล้ว — แจ้งเรื่องได้เฉพาะที่นี่ */
export async function openProjects(tx: Tx, clientId: string) {
  return tx
    .select({ id: projects.id, key: projects.key, name: projects.name })
    .from(projects)
    .where(
      and(
        eq(projects.clientId, clientId),
        eq(projects.portalEnabled, true),
        eq(projects.isArchived, false),
      ),
    );
}

/**
 * ลูกค้ากดส่งเรื่อง
 *
 * ═══ นาฬิกา SLA เริ่มเดินที่บรรทัดนี้ ═══
 * `createTask()` เห็น `origin: 'warranty'` แล้วเปิดนาฬิกาให้เอง (ดู `src/lib/sla.ts`)
 * ตัดสิน 20 ส.ค. 2569 — เริ่ม ณ วินาทีที่ลูกค้ากดส่ง ไม่ใช่ตอนเจ้าหน้าที่กดรับเรื่อง
 * เพื่อประเมินการรับเรื่องของ PM
 *
 * `portal_stage` ยังว่าง — ลูกค้าจึงเห็น "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
 * จนกว่าจะมีคนกดจริง (ไม่มี auto)
 */
export async function createIssue(
  tx: Tx,
  contact: PortalContact,
  input: NewIssue,
): Promise<{ id: string; code: string }> {
  if (!contact.canReport) {
    throw new ApiError('E_FORBIDDEN', 'บัญชีนี้ดูสถานะได้อย่างเดียว แจ้งเรื่องใหม่ไม่ได้');
  }
  const title = input.title.trim();
  if (!title) throw new ApiError('E_INVALID', 'กรอกเรื่องที่พบด้วย', 'title');

  const available = await openProjects(tx, contact.clientId);
  const target = input.projectId
    ? available.find((p) => p.id === input.projectId)
    : available.length === 1
      ? available[0]
      : undefined;

  if (!target) {
    throw new ApiError(
      available.length === 0 ? 'E_UNPROCESSABLE' : 'E_INVALID',
      available.length === 0
        ? 'ยังไม่มีโปรเจกต์ที่เปิดรับแจ้งเรื่อง กรุณาติดต่อทีมงาน'
        : 'เลือกโปรเจกต์ที่ต้องการแจ้งด้วย',
      'projectId',
    );
  }

  // actorId ว่าง เพราะคนแจ้งไม่ใช่คนในทีม · ตัวตนไปอยู่ที่ actor_contact_id แทน
  const created = await createTask(tx, contact.tenantId, target.id, null, {
    title,
    description: input.description,
    origin: 'warranty',
    // ทีมเป็นคนตั้ง priority จริงตอนคัดแยก · ที่ลูกค้าเลือกเก็บแยกที่ reported_impact
    priority: 'medium',
    isClientVisible: true,
    actorContactId: contact.contactId,
  });

  await tx
    .update(tasks)
    .set({ reportedImpact: input.reportedImpact ?? 'degraded' })
    .where(eq(tasks.id, created.id));

  return { id: created.id, code: created.code };
}
