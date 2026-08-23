import { withoutTenant } from '@/db/client';
import { handle } from '@/lib/api/handle';
import { ok } from '@/lib/api/respond';
import { readInvitation } from '@/lib/auth/accounts';

/**
 * GET /api/v1/invitations/{token} — อ่านคำเชิญก่อนกดรับ
 *
 * ต้องเปิดได้ทั้งตอนยังไม่ล็อกอิน (หน้าจอ 05) และตอนล็อกอินด้วยอีเมลที่ไม่ตรง
 * (หน้าจอ 44 ต้องบอกได้ว่าให้สลับไปบัญชีไหน)
 * RLS เปิดให้เฉพาะแถวของโทเคนใบนี้ใบเดียว — การถือโทเคนคือสิทธิ์ในตัวมันเอง
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  return handle(async () => {
    const { token } = await params;
    const view = await withoutTenant((tx) => readInvitation(tx, token));
    return ok(view);
  });
}
