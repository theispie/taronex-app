import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { buildKey, checkUpload, presignUpload } from '@/lib/storage';

/**
 * POST — ขอลิงก์อัปโหลดตรงไปที่เก็บไฟล์
 *
 * ไฟล์ไม่วิ่งผ่านเซิร์ฟเวอร์ของเราเลย เพราะเครื่องมี RAM 1 GB
 * ถ้าไฟล์ 50 MB วิ่งผ่าน Next.js พร้อมกันสองสามคน เครื่องจะถูก OOM killer ฆ่า
 *
 * ตรวจสิทธิ์ที่นี่ครั้งเดียว แล้วลิงก์มีอายุ 5 นาที
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{ projectId: string; filename: string; mime: string; size: number }>(req);

    const result = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, str(b.projectId, 'projectId'));
      requireProjectWrite(p);
      const filename = str(b.filename, 'filename');
      const mime = str(b.mime, 'mime');
      checkUpload(filename, mime, Number(b.size));
      const key = buildKey(ctx.tenantId, p.projectId, filename);
      return { key, projectId: p.projectId, mime };
    });

    const uploadUrl = await presignUpload(result.key, result.mime);
    return ok({ uploadUrl, storageKey: result.key, expiresInSeconds: 300 });
  });
}
