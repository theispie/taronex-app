import { withoutTenant } from '@/db/client';
import { ok } from '@/lib/api/respond';
import { clearSessionCookie, currentToken, destroySession } from '@/lib/auth/session';

/** POST /api/v1/auth/logout — ทำลายเซสชันปัจจุบันเท่านั้น ไม่แตะเครื่องอื่น */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  const token = await currentToken();
  if (token) await withoutTenant((tx) => destroySession(tx, token));
  await clearSessionCookie();
  return ok({ ok: true });
}
