/**
 * เซสชัน — เก็บแค่ตัวตน ไม่ผูกกับที่ทำงาน
 *
 * ที่ทำงานมาจาก URL (/app/<code>) แล้วตรวจกับ memberships ทุก request
 * รหัสใน URL **ไม่ใช่สิทธิ์** มันโผล่ในประวัติเบราว์เซอร์และ log ของ proxy
 * ถ้าเซสชันผูกกับที่ทำงาน คนที่อยู่หลายที่ทำงานจะต้องล็อกอินใหม่ทุกครั้งที่สลับ
 *
 * ═══ กฎข้อ 6 ═══
 * คุกกี้ฝั่งทีมกับพอร์ทัลลูกค้าต้องคนละชื่อโดยเด็ดขาด
 * ตอนนี้อยู่ origin เดียวกันเพราะแยก tenant ด้วย path
 * ซึ่งขัดกับสเปคเดิมที่ให้อยู่คนละโดเมน — ก่อนรับลูกค้าจริงต้องแยกโดเมนคืน
 */

import { and, eq, gt, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { Tx } from '@/db/client';
import { memberships, sessions, users } from '@/db/schema';
import { DAY, generateToken, hashToken, SESSION_TTL_DAYS } from './tokens';

export const TEAM_COOKIE = 'tnx_session';
export const PORTAL_COOKIE = 'tnx_portal';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

/** สร้างเซสชันใหม่แล้วคืนค่าดิบให้เอาไปวางในคุกกี้ · ฐานข้อมูลเก็บแค่ hash */
export async function createSession(tx: Tx, userId: string): Promise<string> {
  const token = generateToken();
  await tx.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY),
  });
  return token;
}

/**
 * ทำลายเซสชันทุกเครื่องของผู้ใช้คนนี้
 * ใช้ตอนตั้งรหัสใหม่ — ถ้ารหัสหลุด การเปลี่ยนรหัสต้องเตะคนที่สวมสิทธิ์อยู่ออกด้วย
 * ไม่งั้นเปลี่ยนรหัสแล้วคนร้ายยังอยู่ในระบบต่อได้
 */
export async function destroyAllSessions(tx: Tx, userId: string): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.userId, userId));
}

export async function destroySession(tx: Tx, token: string): Promise<void> {
  await tx.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  /** ว่างได้ — ยังไม่ได้ต่อที่เก็บไฟล์ จึงยังอัปรูปไม่ได้ หน้าจอจะตกไปใช้อักษรย่อแทน */
  avatarUrl: string | null;
}

/** อ่านคุกกี้แล้วคืนตัวตน · คืน null ถ้าไม่มี หมดอายุ หรือบัญชีถูกปิด */
export async function currentUser(tx: Tx): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(TEAM_COOKIE)?.value;
  if (!raw) return null;

  const rows = await tx
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(raw)),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** ผู้ใช้คนนี้เป็นสมาชิกของที่ทำงานนี้หรือเปล่า — ตรวจทุก request ไม่เชื่อรหัสใน URL */
export async function membershipOf(
  tx: Tx,
  userId: string,
  tenantId: string,
): Promise<{ role: 'owner' | 'member' | 'viewer' | 'guest' } | null> {
  const rows = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.tenantId, tenantId),
        isNull(memberships.deactivatedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function currentToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(TEAM_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(TEAM_COOKIE, token, { ...COOKIE_OPTS, maxAge: SESSION_TTL_DAYS * 86400 });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(TEAM_COOKIE);
}
