import { inTenant } from '@/lib/api/context';
import { ApiError } from '@/lib/api/errors';
import { handle } from '@/lib/api/handle';
import { loadProject } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { presignDownload } from '@/lib/storage';
import { getAttachment } from '@/lib/tasks';

/** GET — ลิงก์ชั่วคราวอายุ 5 นาที · ตรวจสิทธิ์ทุกครั้งที่ขอ ไม่ใช่แจกลิงก์ถาวร */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const a = await inTenant(tenant, async (tx, ctx) => {
      const found = await getAttachment(tx, id);
      await loadProject(tx, ctx, found.projectId);
      return found;
    });
    if (!a.storageKey) throw new ApiError('E_NOT_FOUND', 'ไฟล์นี้ไม่ได้เก็บไว้กับเรา');
    const url = await presignDownload(a.storageKey, a.filename);
    return ok({ url, filename: a.filename, expiresInSeconds: 300 });
  });
}
