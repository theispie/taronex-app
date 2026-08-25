/**
 * ตรรกะของ M2 — บัญชี หลายที่ทำงาน และบทบาท
 *
 * เขียนเป็นฟังก์ชันที่รับ Tx เข้ามา ไม่ใช่ผูกกับ Request
 * เพื่อให้เทสต์เรียกตรงได้โดยไม่ต้องยิง HTTP และให้ route ทำหน้าที่แค่
 * แปลง input/output กับตัดสินสิทธิ์ ไม่มีตรรกะธุรกิจซ้ำสองที่
 */

import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { invitations, memberships, projects, tenants, users } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { generateTenantCode } from '@/lib/tenant-code';
import { hashPassword, passwordProblems, verifyPassword } from './password';
import { createSession, destroyAllSessions } from './session';
import { DAY, generateToken, hashToken, INVITE_TTL_DAYS } from './tokens';

export type Role = 'owner' | 'member' | 'viewer' | 'guest';
export type JobTitleValue = 'pm' | 'ba' | 'dev' | 'qa' | 'design' | 'other';

const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** ชุดคอลัมน์เริ่มต้นตอนสร้างโปรเจกต์โดยไม่ได้เลือกแม่แบบ */
export const DEFAULT_BOARD = [
  { key: 'todo', name: 'รอเริ่ม' },
  { key: 'doing', name: 'กำลังทำ' },
  { key: 'review', name: 'รอตรวจ' },
  { key: 'done', name: 'เสร็จ' },
];

// ─────────────────────────── สมัครและเข้าสู่ระบบ ───────────────────────────

export interface SignupInput {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

/**
 * สร้าง users + tenants + memberships(owner) ในธุรกรรมเดียว
 * ไม่มีขั้นเลือกแผน — คนหลุดตรงนั้นมากที่สุด
 */
export async function signup(
  tx: Tx,
  enterTenant: (id: string) => Promise<void>,
  input: SignupInput,
): Promise<{ userId: string; tenantId: string; slug: string; token: string }> {
  const email = normalizeEmail(input.email);
  const problems = passwordProblems(input.password);
  if (problems.length > 0) throw new ApiError('E_INVALID', problems.join(' · '), 'password');

  const existing = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) throw new ApiError('E_CONFLICT', 'อีเมลนี้มีบัญชีอยู่แล้ว', 'email');

  const [user] = await tx
    .insert(users)
    .values({ email, name: input.name.trim(), passwordHash: await hashPassword(input.password) })
    .returning({ id: users.id });
  if (!user) throw new ApiError('E_UNPROCESSABLE', 'สร้างบัญชีไม่สำเร็จ');

  const [tenant] = await tx
    .insert(tenants)
    .values({ name: input.companyName.trim(), slug: generateTenantCode(), status: 'trial' })
    .returning({ id: tenants.id, slug: tenants.slug });
  if (!tenant) throw new ApiError('E_UNPROCESSABLE', 'สร้างที่ทำงานไม่สำเร็จ');

  // ต้องเข้าไปอยู่ในขอบเขตของที่ทำงานใหม่ก่อน ไม่งั้น RLS ปฏิเสธการเขียน memberships
  await enterTenant(tenant.id);
  await tx.insert(memberships).values({
    tenantId: tenant.id,
    userId: user.id,
    role: 'owner',
    jobTitle: 'pm',
  });

  const token = await createSession(tx, user.id);
  return { userId: user.id, tenantId: tenant.id, slug: tenant.slug, token };
}

/**
 * เข้าสู่ระบบ — ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือรหัสผิด
 * ไม่งั้นหน้าล็อกอินจะกลายเป็นเครื่องมือไล่เช็คว่าอีเมลไหนมีบัญชีอยู่
 */
export async function login(tx: Tx, emailRaw: string, password: string): Promise<string> {
  const email = normalizeEmail(emailRaw);
  const rows = await tx
    .select({ id: users.id, hash: users.passwordHash, active: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const row = rows[0];
  // ถ่วงเวลาให้เท่ากันแม้ไม่พบบัญชี กันการวัดเวลาเพื่อไล่เช็คอีเมล
  const hashed =
    row?.hash ??
    '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const okPassword = await verifyPassword(hashed, password);

  if (!row || !row.active || !okPassword) {
    throw new ApiError('E_UNAUTHENTICATED', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  return createSession(tx, row.id);
}

/**
 * ตั้งรหัสใหม่ + ทำลายเซสชันทุกเครื่อง
 * ถ้ารหัสหลุด การเปลี่ยนรหัสต้องเตะคนที่สวมสิทธิ์อยู่ออกด้วย
 */
export async function resetPassword(tx: Tx, userId: string, newPassword: string): Promise<void> {
  const problems = passwordProblems(newPassword);
  if (problems.length > 0) throw new ApiError('E_INVALID', problems.join(' · '), 'password');

  await tx
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, userId));
  await destroyAllSessions(tx, userId);
}

// ─────────────────────────── หลายที่ทำงาน (กฎข้อ 11) ───────────────────────────

export interface WorkspaceRow {
  tenantId: string;
  slug: string;
  name: string;
  role: Role;
  status: string;
}

/** GET /me/workspaces — กรองด้วย user_id ของ session เท่านั้น */
export async function listWorkspaces(tx: Tx, userId: string): Promise<WorkspaceRow[]> {
  return tx
    .select({
      tenantId: tenants.id,
      slug: tenants.slug,
      name: tenants.name,
      role: memberships.role,
      status: tenants.status,
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.deactivatedAt)));
}

/** POST /workspaces — สร้างที่ทำงานใหม่จากบัญชีเดิม ไม่สร้าง users ใหม่ */
export async function createWorkspace(
  tx: Tx,
  enterTenant: (id: string) => Promise<void>,
  userId: string,
  name: string,
): Promise<{ tenantId: string; slug: string }> {
  const [tenant] = await tx
    .insert(tenants)
    .values({ name: name.trim(), slug: generateTenantCode(), status: 'trial' })
    .returning({ id: tenants.id, slug: tenants.slug });
  if (!tenant) throw new ApiError('E_UNPROCESSABLE', 'สร้างที่ทำงานไม่สำเร็จ');

  await enterTenant(tenant.id);
  await tx.insert(memberships).values({
    tenantId: tenant.id,
    userId,
    role: 'owner',
    jobTitle: 'other',
  });
  return { tenantId: tenant.id, slug: tenant.slug };
}

// ─────────────────────────── คำเชิญ ───────────────────────────

export interface InviteInput {
  email: string;
  role: Role;
  jobTitle: JobTitleValue;
}

/** POST /members/invite — เชิญซ้ำอีเมลเดิม = ลบใบเก่าแล้วออกใบใหม่ */
export async function inviteMember(
  tx: Tx,
  tenantId: string,
  invitedBy: string,
  input: InviteInput,
): Promise<string> {
  const email = normalizeEmail(input.email);
  await tx
    .delete(invitations)
    .where(
      and(
        eq(invitations.tenantId, tenantId),
        eq(invitations.email, email),
        isNull(invitations.acceptedAt),
      ),
    );

  const token = generateToken();
  await tx.insert(invitations).values({
    tenantId,
    email,
    role: input.role,
    jobTitle: input.jobTitle,
    tokenHash: hashToken(token),
    invitedBy,
    expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY),
  });
  return token;
}

/**
 * เปิดให้ธุรกรรมนี้อ่านคำเชิญของโทเคนใบนี้ได้ใบเดียว
 *
 * ต้องเรียกก่อน query เสมอ เพราะ RLS ปิดตาราง invitations ไว้
 * และคนที่กำลังเปิดลิงก์อาจยังไม่ได้ล็อกอิน หรือล็อกอินด้วยอีเมลที่ไม่ตรง
 * การถือโทเคนคือสิทธิ์ในตัวมันเอง และเปิดได้ทีละแถวเท่านั้น
 */
async function unlockInvite(tx: Tx, token: string): Promise<void> {
  await tx.execute(sql`select set_config('app.invite_token_hash', ${hashToken(token)}, true)`);
}

export interface InvitationView {
  tenantName: string;
  email: string;
  role: Role;
  invitedByName: string | null;
  expiresAt: Date;
}

/**
 * GET /invitations/:token — อ่านคำเชิญก่อนกดรับ
 * หน้าจอ 44 ต้องรู้ว่าอีเมลที่ล็อกอินอยู่ไม่ตรงกับคำเชิญ ถึงจะเสนอให้สลับบัญชีได้
 */
export async function readInvitation(tx: Tx, token: string): Promise<InvitationView> {
  await unlockInvite(tx, token);
  const rows = await tx
    .select({
      tenantName: tenants.name,
      email: invitations.email,
      role: invitations.role,
      invitedByName: users.name,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND', 'คำเชิญนี้ใช้ไม่ได้แล้ว');
  return row;
}

/**
 * POST /invitations/:token/accept
 *
 * ═══ ห้ามสร้าง tenants ที่นี่เด็ดขาด ═══
 * เป็นความผิดพลาดที่เกิดง่ายมาก เพราะเส้นทางนี้หน้าตาคล้ายการสมัคร
 * ถ้าพลาด คนที่รับคำเชิญจะได้ที่ทำงานใหม่ของตัวเองแทนที่จะเข้าทีมที่เชิญมา
 * แล้วจะงงกันทั้งสองฝ่ายว่าทำไมไม่เห็นข้อมูลเดียวกัน
 *
 * ต้องเทียบ invitations.email กับ users.email ของ session ด้วย
 * ไม่ใช่เชื่อโทเคนอย่างเดียว — ไม่งั้นใครได้ลิงก์ไปก็เข้าทีมได้
 */
export async function acceptInvitation(
  tx: Tx,
  token: string,
  user: { id: string; email: string },
): Promise<{ tenantId: string; slug: string }> {
  await unlockInvite(tx, token);
  const rows = await tx
    .select({
      id: invitations.id,
      tenantId: invitations.tenantId,
      email: invitations.email,
      role: invitations.role,
      jobTitle: invitations.jobTitle,
      slug: tenants.slug,
    })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const inv = rows[0];
  if (!inv) throw new ApiError('E_NOT_FOUND', 'คำเชิญนี้ใช้ไม่ได้แล้ว');

  if (normalizeEmail(inv.email) !== normalizeEmail(user.email)) {
    throw new ApiError('E_FORBIDDEN', `คำเชิญนี้ส่งถึง ${inv.email} แต่คุณเข้าสู่ระบบด้วยอีเมลอื่น`, 'email');
  }

  // เข้าทีมที่เชิญมา — ไม่สร้างที่ทำงานใหม่
  await tx.execute(sql`select set_config('app.tenant_id', ${inv.tenantId}, true)`);
  await tx
    .insert(memberships)
    .values({ tenantId: inv.tenantId, userId: user.id, role: inv.role, jobTitle: inv.jobTitle })
    .onConflictDoNothing();

  await tx
    .update(invitations)
    .set({ acceptedAt: new Date(), acceptedByUserId: user.id })
    .where(eq(invitations.id, inv.id));

  return { tenantId: inv.tenantId, slug: inv.slug };
}

// ─────────────────────────── สมาชิกและบทบาท ───────────────────────────

export async function countActiveOwners(
  tx: Tx,
  tenantId: string,
  exceptUserId?: string,
): Promise<number> {
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(memberships)
    .where(
      and(
        eq(memberships.tenantId, tenantId),
        eq(memberships.role, 'owner'),
        isNull(memberships.deactivatedAt),
        exceptUserId ? ne(memberships.userId, exceptUserId) : undefined,
      ),
    );
  return rows[0]?.n ?? 0;
}

/** POST /members/:id/revoke-owner — trigger ที่ฐานข้อมูลกันไว้อีกชั้น แต่ตอบให้สวยกว่าถ้าเช็คก่อน */
export async function revokeOwner(tx: Tx, tenantId: string, userId: string): Promise<void> {
  if ((await countActiveOwners(tx, tenantId, userId)) === 0) {
    throw new ApiError('E_LAST_OWNER');
  }
  await tx
    .update(memberships)
    .set({ role: 'member' })
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

/** POST /workspaces/:id/leave — เจ้าของคนสุดท้ายออกไม่ได้ */
export async function leaveWorkspace(tx: Tx, tenantId: string, userId: string): Promise<void> {
  const rows = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND');

  if (row.role === 'owner' && (await countActiveOwners(tx, tenantId, userId)) === 0) {
    throw new ApiError('E_LAST_OWNER', 'คุณเป็นเจ้าของคนสุดท้าย ต้องแต่งตั้งคนอื่นก่อนออก');
  }
  await tx
    .delete(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

// ─────────────────────────── ลืมรหัสผ่าน ───────────────────────────

/**
 * โทเคนตั้งรหัสใหม่ — เซ็นด้วย HMAC ไม่เก็บลงฐานข้อมูล
 *
 * ═══ ทำไมไม่ทำตารางเก็บ ═══
 * พจนานุกรมข้อมูลไม่มีตารางสำหรับโทเคนตั้งรหัสใหม่ และ CLAUDE.md ห้ามเพิ่มตาราง
 * ที่ไม่มีในพจนานุกรมโดยไม่ถามก่อน จึงเลือกทางที่ไม่ต้องเพิ่มตาราง
 *
 * ใช้ครั้งเดียวได้จริงเพราะเอา hash รหัสผ่านปัจจุบันมาเซ็นด้วย
 * พอตั้งรหัสใหม่สำเร็จ hash เปลี่ยน ลายเซ็นเดิมจึงใช้ไม่ได้อีก
 *
 * ข้อเสียที่ต้องยอมรับ — เพิกถอนโทเคนทีละใบก่อนหมดอายุไม่ได้
 * ถ้าวันหนึ่งต้องการแบบนั้น ให้ทำตาราง password_resets แล้วค่อยย้ายมา
 */
import { createHmac, timingSafeEqual as tse } from 'node:crypto';
import { signingSecret } from './secret';

function signReset(userId: string, pwHash: string, expiresAt: number): string {
  const body = `${userId}.${expiresAt}`;
  const mac = createHmac('sha256', signingSecret()).update(`${body}.${pwHash}`).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
}

/**
 * POST /auth/forgot — ตอบเหมือนกันเสมอไม่ว่าอีเมลจะมีจริงหรือไม่
 * คืน null เมื่อไม่มีบัญชี ตัวเรียกต้องตอบข้อความเดียวกันทั้งสองกรณี
 */
export async function createResetToken(tx: Tx, emailRaw: string): Promise<string | null> {
  const email = normalizeEmail(emailRaw);
  const rows = await tx
    .select({ id: users.id, hash: users.passwordHash })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const exp = Date.now() + 2 * 3_600_000;
  return signReset(row.id, row.hash ?? '', exp);
}

/** ตรวจโทเคนแล้วคืน user_id · โยน 404 ถ้าใช้ไม่ได้ */
export async function verifyResetToken(tx: Tx, token: string): Promise<string> {
  const [bodyB64, mac] = token.split('.');
  if (!bodyB64 || !mac) throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้ใช้ไม่ได้แล้ว');

  const body = Buffer.from(bodyB64, 'base64url').toString();
  const [userId, expStr] = body.split('.');
  if (!userId || !expStr) throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้ใช้ไม่ได้แล้ว');
  if (Number(expStr) < Date.now()) throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้หมดอายุแล้ว');

  const rows = await tx
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้ใช้ไม่ได้แล้ว');

  const expected = signReset(userId, row.hash ?? '', Number(expStr)).split('.')[1] ?? '';
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !tse(a, b)) {
    throw new ApiError('E_NOT_FOUND', 'ลิงก์นี้ใช้ไม่ได้แล้ว');
  }
  return userId;
}

// ─────────────────────────── บัญชีและโปรไฟล์ ───────────────────────────

/** PATCH /account — ข้อมูลของคน ไม่ใช่ของที่ทำงาน */
export async function updateAccount(
  tx: Tx,
  userId: string,
  patch: { name?: string; locale?: string; password?: string; currentPassword?: string },
): Promise<void> {
  const set: Record<string, string> = {};
  if (patch.name?.trim()) set.name = patch.name.trim();
  if (patch.locale?.trim()) set.locale = patch.locale.trim();

  if (patch.password) {
    const rows = await tx
      .select({ hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const current = rows[0]?.hash ?? '';
    // เปลี่ยนรหัสต้องยืนยันรหัสเดิมเสมอ ไม่งั้นใครยืมเครื่องที่เปิดค้างไว้ก็ยึดบัญชีได้
    if (!patch.currentPassword || !(await verifyPassword(current, patch.currentPassword))) {
      throw new ApiError('E_FORBIDDEN', 'รหัสผ่านเดิมไม่ถูกต้อง', 'currentPassword');
    }
    const problems = passwordProblems(patch.password);
    if (problems.length > 0) throw new ApiError('E_INVALID', problems.join(' · '), 'password');
    set.passwordHash = await hashPassword(patch.password);
  }

  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');
  await tx.update(users).set(set).where(eq(users.id, userId));
  // เปลี่ยนรหัสแล้วเซสชันอื่นต้องตาย รวมทั้งเครื่องที่กำลังใช้อยู่ด้วย
  if (set.passwordHash) await destroyAllSessions(tx, userId);
}

/** PATCH /me — ตำแหน่งงานอยู่ที่ memberships เพราะคนเดียวกันมีตำแหน่งต่างกันได้แต่ละที่ทำงาน */
export async function updateMembershipProfile(
  tx: Tx,
  tenantId: string,
  userId: string,
  jobTitle: JobTitleValue,
): Promise<void> {
  await tx
    .update(memberships)
    .set({ jobTitle })
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

// ─────────────────────────── คำเชิญที่ค้างอยู่ ───────────────────────────

/** GET /me/invitations — หนึ่งในสี่เส้นทางที่ข้าม tenant ได้ (กฎข้อ 11) */
export async function listMyInvitations(tx: Tx, email: string) {
  return tx
    .select({
      tenantName: tenants.name,
      role: invitations.role,
      invitedByName: users.name,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(tenants, eq(tenants.id, invitations.tenantId))
    .leftJoin(users, eq(users.id, invitations.invitedBy))
    .where(
      and(
        eq(invitations.email, normalizeEmail(email)),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    );
}

// ─────────────────────────── จัดการสมาชิก ───────────────────────────

export async function grantOwner(tx: Tx, tenantId: string, userId: string): Promise<void> {
  await tx
    .update(memberships)
    .set({ role: 'owner' })
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

export async function setMemberRole(
  tx: Tx,
  tenantId: string,
  userId: string,
  patch: { role?: Role; jobTitle?: JobTitleValue },
): Promise<void> {
  const set: Record<string, string> = {};
  if (patch.role) set.role = patch.role;
  if (patch.jobTitle) set.jobTitle = patch.jobTitle;
  if (Object.keys(set).length === 0) throw new ApiError('E_INVALID', 'ไม่มีอะไรให้แก้');

  // ลดบทบาทเจ้าของคนสุดท้ายไม่ได้ · trigger ที่ฐานข้อมูลกันไว้อีกชั้น
  if (patch.role && patch.role !== 'owner') {
    const rows = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
      .limit(1);
    if (rows[0]?.role === 'owner' && (await countActiveOwners(tx, tenantId, userId)) === 0) {
      throw new ApiError('E_LAST_OWNER');
    }
  }
  await tx
    .update(memberships)
    .set(set)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

/** ปิดใช้งานแทนการลบ — task_events ต้องชี้ตัวตนเดิมได้เสมอ (กฎข้อ 7) */
export async function deactivateMember(tx: Tx, tenantId: string, userId: string): Promise<void> {
  const rows = await tx
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new ApiError('E_NOT_FOUND');
  if (rows[0].role === 'owner' && (await countActiveOwners(tx, tenantId, userId)) === 0) {
    throw new ApiError('E_LAST_OWNER');
  }
  const pm = await tx
    .select({ key: projects.key })
    .from(projects)
    .where(and(eq(projects.pmUserId, userId), eq(projects.isArchived, false)));
  if (pm.length > 0) {
    throw new ApiError(
      'E_STILL_PM',
      `ยังเป็น PM ของ ${pm.map((p) => p.key).join(' · ')} ต้องเลือกคนรับช่วงก่อน`,
    );
  }
  await tx
    .update(memberships)
    .set({ deactivatedAt: new Date() })
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
}

/** DELETE /members/:id — ถอดออกจากทีม · ข้อมูลที่เขาทำไว้ยังอยู่ครบ */
export async function removeMember(tx: Tx, tenantId: string, userId: string): Promise<void> {
  const pm = await tx
    .select({ key: projects.key })
    .from(projects)
    .where(and(eq(projects.pmUserId, userId), eq(projects.isArchived, false)));
  if (pm.length > 0) {
    throw new ApiError(
      'E_STILL_PM',
      `ยังเป็น PM ของ ${pm.map((p) => p.key).join(' · ')} ต้องย้าย PM ก่อน`,
    );
  }
  await leaveWorkspace(tx, tenantId, userId);
}
