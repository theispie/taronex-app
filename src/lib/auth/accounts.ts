/**
 * ตรรกะของ M2 — บัญชี หลายที่ทำงาน และบทบาท
 *
 * เขียนเป็นฟังก์ชันที่รับ Tx เข้ามา ไม่ใช่ผูกกับ Request
 * เพื่อให้เทสต์เรียกตรงได้โดยไม่ต้องยิง HTTP และให้ route ทำหน้าที่แค่
 * แปลง input/output กับตัดสินสิทธิ์ ไม่มีตรรกะธุรกิจซ้ำสองที่
 */

import { and, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { Tx } from '@/db/client';
import { invitations, memberships, tenants, users } from '@/db/schema';
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
