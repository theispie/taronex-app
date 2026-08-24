/**
 * เซสชันพอร์ทัลลูกค้า — แยกจากเซสชันของทีมโดยสิ้นเชิง (กฎข้อ 6)
 *
 * ═══ ทำไมต้องแยกให้ขาด ═══
 * สเปคเดิมให้พอร์ทัลอยู่คนละโดเมน เบราว์เซอร์จะบังคับแยกคุกกี้ให้เอง
 * พอย้ายมาอยู่ origin เดียวกัน (แยก tenant ด้วย path) การแยกต้องทำด้วยโค้ดล้วน
 *   · คุกกี้คนละชื่อ — `tnx_portal` ไม่ใช่ `tnx_session`
 *   · คนละ secret — เอา `portal:` นำหน้าตอนเซ็น ลายเซ็นของอีกฝั่งจึงใช้ข้ามไม่ได้
 *   · API ฝั่งพอร์ทัล **ไม่แตะ `tnx_session` เลย** ต่อให้ผู้ใช้ล็อกอินฝั่งทีมอยู่ก็ไม่มีผล
 *
 * ═══ ทำไมเซสชันไม่เก็บลงตาราง ═══
 * `portal_tokens` ในพจนานุกรมข้อมูลคือ**ลิงก์เข้าใช้งานครั้งเดียว** ไม่ใช่เซสชัน
 * (มี `used_at` ที่ทำให้เป็นโมฆะทันทีหลังใช้) จะเอามาใช้เป็นเซสชันก็ผิดความหมาย
 * และ CLAUDE.md ห้ามเพิ่มตารางที่ไม่มีในพจนานุกรมโดยไม่ถามก่อน
 *
 * จึงเซ็นเป็นคุกกี้แบบไม่เก็บสถานะ พร้อมข้อเสียที่ต้องยอมรับ —
 * **เพิกถอนเซสชันทีละใบก่อนหมดอายุไม่ได้** ถ้าต้องตัดสิทธิ์ทันทีให้ลบผู้ติดต่อ
 * ซึ่งตัดได้จริงเพราะทุกคำขอตรวจว่าผู้ติดต่อยังอยู่ในฐานข้อมูลเสมอ
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { Tx } from '@/db/client';
import { clientContacts, clients, tenants } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';

export const PORTAL_COOKIE = 'tnx_portal';

/** 14 วัน — สั้นกว่าเซสชันทีม (30 วัน) เพราะเป็นเครื่องของคนนอกองค์กร */
const PORTAL_SESSION_DAYS = 14;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

const secret = () => process.env.SESSION_SECRET ?? 'dev-only-secret-do-not-use-in-production';

/**
 * `portal:` ที่นำหน้าคือสิ่งที่ทำให้ลายเซ็นสองฝั่งใช้ข้ามกันไม่ได้
 * ถึงจะแชร์ SESSION_SECRET ตัวเดียวกัน โทเคนของฝั่งทีมก็ผ่านการตรวจของพอร์ทัลไม่ได้
 */
function sign(body: string): string {
  return createHmac('sha256', secret()).update(`portal:${body}`).digest('base64url');
}

function makeCookie(tenantId: string, contactId: string, expiresAt: number): string {
  const body = `${tenantId}.${contactId}.${expiresAt}`;
  return `${Buffer.from(body).toString('base64url')}.${sign(body)}`;
}

export interface PortalSession {
  tenantId: string;
  contactId: string;
}

/** อ่านคุกกี้แล้วคืนตัวตน · คืน null ถ้าไม่มี ปลอม หรือหมดอายุ */
function readCookieValue(raw: string): PortalSession | null {
  const [bodyB64, mac] = raw.split('.');
  if (!bodyB64 || !mac) return null;

  const body = Buffer.from(bodyB64, 'base64url').toString();
  const [tenantId, contactId, expStr] = body.split('.');
  if (!tenantId || !contactId || !expStr) return null;
  if (Number(expStr) < Date.now()) return null;

  const a = Buffer.from(mac);
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { tenantId, contactId };
}

export async function setPortalCookie(tenantId: string, contactId: string): Promise<void> {
  const exp = Date.now() + PORTAL_SESSION_DAYS * 86_400_000;
  const jar = await cookies();
  jar.set(PORTAL_COOKIE, makeCookie(tenantId, contactId, exp), {
    ...COOKIE_OPTS,
    maxAge: PORTAL_SESSION_DAYS * 86400,
  });
}

export async function clearPortalCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(PORTAL_COOKIE);
}

/** แปลงรหัสใน URL เป็น tenant · ไม่ใช่สิทธิ์ แค่บอกว่ากำลังดูพอร์ทัลของใคร */
export async function tenantBySlug(tx: Tx, slug: string): Promise<{ id: string; name: string }> {
  const rows = await tx
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  const t = rows[0];
  if (!t) throw new ApiError('E_NOT_FOUND');
  return t;
}

export interface PortalContact {
  tenantId: string;
  contactId: string;
  clientId: string;
  clientName: string;
  name: string;
  email: string;
  canReport: boolean;
  canSeeAll: boolean;
  tenantName: string;
}

/**
 * ตัวตนของผู้ติดต่อในคำขอนี้ — ประตูเดียวของฝั่งพอร์ทัล
 *
 * ตรวจสามชั้น ห้ามตัดชั้นไหนออก
 *   1. ลายเซ็นคุกกี้ถูกต้องและยังไม่หมดอายุ
 *   2. **tenant ในคุกกี้ตรงกับ tenant ใน URL** — ไม่งั้นผู้ติดต่อของ ก
 *      แก้ URL เป็นของ ข แล้วอ่านข้อมูลอีกที่ทำงานได้ทันที
 *   3. ผู้ติดต่อยังมีอยู่จริงในฐานข้อมูล — นี่คือทางเพิกถอนสิทธิ์
 */
export async function requirePortalContact(tx: Tx, tenantId: string): Promise<PortalContact> {
  const jar = await cookies();
  const raw = jar.get(PORTAL_COOKIE)?.value;
  if (!raw) throw new ApiError('E_UNAUTHENTICATED', 'กรุณาขอลิงก์เข้าใช้งานใหม่');

  const s = readCookieValue(raw);
  if (!s) throw new ApiError('E_UNAUTHENTICATED', 'ลิงก์หมดอายุแล้ว กรุณาขอใหม่');
  if (s.tenantId !== tenantId) throw new ApiError('E_NOT_FOUND');

  const rows = await tx
    .select({
      contactId: clientContacts.id,
      clientId: clientContacts.clientId,
      name: clientContacts.name,
      email: clientContacts.email,
      canReport: clientContacts.canReport,
      canSeeAll: clientContacts.canSeeAll,
      clientName: clients.name,
      tenantName: tenants.name,
    })
    .from(clientContacts)
    .innerJoin(clients, eq(clients.id, clientContacts.clientId))
    .innerJoin(tenants, eq(tenants.id, clientContacts.tenantId))
    .where(and(eq(clientContacts.id, s.contactId), eq(clientContacts.tenantId, tenantId)))
    .limit(1);
  const c = rows[0];
  if (!c) throw new ApiError('E_UNAUTHENTICATED', 'สิทธิ์เข้าใช้งานถูกยกเลิกแล้ว');

  return { tenantId, ...c };
}
