/**
 * ด่านที่ทุก request ต้องผ่าน — แปลง URL + คุกกี้ เป็น "ใครกำลังทำอะไรที่ไหน"
 *
 * ═══ จุดที่พลาดแล้วข้อมูลรั่วข้ามบริษัท ═══
 * รหัสที่ทำงานใน URL (/app/<code>) **ไม่ใช่สิทธิ์**
 * มันโผล่ในประวัติเบราว์เซอร์ ใน log ของ proxy และในลิงก์ที่คนส่งต่อกัน
 * ทุก request จึงต้องตรวจ memberships ฝั่งเซิร์ฟเวอร์ ห้ามเชื่อรหัสใน URL เด็ดขาด
 *
 * ไม่ผ่านตอบ 404 ไม่ใช่ 403 — 403 เป็นการยืนยันว่าที่ทำงานนั้นมีอยู่จริง
 */

import { eq } from 'drizzle-orm';
import { type Tx, withAccount, withoutTenant, withTenant } from '@/db/client';
import { tenants } from '@/db/schema';
import { currentUser, membershipOf } from '@/lib/auth/session';
import { isValidTenantCode } from '@/lib/tenant-code';
import { ApiError } from './errors';

export interface TenantContext {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  slug: string;
  role: 'owner' | 'member' | 'viewer' | 'guest';
}

/** ต้องล็อกอินแล้ว แต่ยังไม่ผูกกับที่ทำงานไหน */
export async function requireUser(): Promise<{ userId: string; email: string; name: string }> {
  const user = await withoutTenant((tx) => currentUser(tx));
  if (!user) throw new ApiError('E_UNAUTHENTICATED');
  return user;
}

/**
 * ต้องล็อกอินแล้ว และเป็นสมาชิกของที่ทำงานที่ระบุในเส้นทาง
 * คืนบริบทที่ route เอาไปเปิด withTenant() ต่อได้เลย
 */
export async function requireTenant(slug: string): Promise<TenantContext> {
  const user = await requireUser();

  // รูปแบบไม่ถูกก็ไม่ต้องถามฐานข้อมูล และตอบเหมือนไม่พบเหมือนกัน
  if (!isValidTenantCode(slug)) throw new ApiError('E_NOT_FOUND');

  const found = await withoutTenant(async (tx) => {
    const rows = await tx
      .select({ id: tenants.id, slug: tenants.slug, status: tenants.status })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    return rows[0] ?? null;
  });
  if (!found) throw new ApiError('E_NOT_FOUND');

  // ต้องถามในขอบเขตบัญชี ไม่ใช่ withoutTenant
  // เพราะ memberships เปิด RLS ไว้ — ถ้าไม่ตั้ง app.user_id จะได้ 0 แถวเสมอ
  // แล้วทุกคนจะถูกมองว่า "ไม่ใช่สมาชิก" รวมทั้งเจ้าของที่ทำงานเอง
  const member = await withAccount(user.userId, user.email, (tx) =>
    membershipOf(tx, user.userId, found.id),
  );
  // ไม่ได้เป็นสมาชิก = ตอบว่าไม่พบ ไม่ใช่ว่าไม่มีสิทธิ์
  if (!member) throw new ApiError('E_NOT_FOUND');

  if (found.status === 'suspended') throw new ApiError('E_TENANT_SUSPENDED');

  return {
    ...user,
    tenantId: found.id,
    slug: found.slug,
    role: member.role,
  };
}

/** ทางลัดที่ใช้บ่อยที่สุด — ตรวจสิทธิ์แล้วเปิดธุรกรรมของที่ทำงานนั้นให้เลย */
export async function inTenant<T>(
  slug: string,
  fn: (tx: Tx, ctx: TenantContext) => Promise<T>,
): Promise<T> {
  const ctx = await requireTenant(slug);
  return withTenant(ctx.tenantId, (tx) => fn(tx, ctx));
}

/** เจ้าของเท่านั้น — ใช้กับเส้นทางที่เปลี่ยนบทบาทหรือตั้งค่าที่ทำงาน */
export function requireOwner(ctx: TenantContext): void {
  if (ctx.role !== 'owner') throw new ApiError('E_OWNER_ONLY');
}

/** ผู้ชมและแขกเขียนอะไรในระดับที่ทำงานไม่ได้เลย */
export function requireWriter(ctx: TenantContext): void {
  if (ctx.role === 'viewer' || ctx.role === 'guest') throw new ApiError('E_READ_ONLY');
}
