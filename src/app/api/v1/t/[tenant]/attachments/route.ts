import { inTenant } from '@/lib/api/context';
import { body, handle, str } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { checkUpload } from '@/lib/storage';
import { recordAttachment } from '@/lib/tasks';

/**
 * POST — บันทึกข้อมูลไฟล์หลังอัปโหลดเสร็จ
 * ตรวจซ้ำอีกรอบ เพราะขั้น presign กับขั้นนี้เป็นคนละคำขอ
 * คนที่ได้ลิงก์ไปอาจส่งค่าอื่นกลับมาก็ได้
 */
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ tenant: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant } = await params;
    const b = await body<{
      projectId: string;
      taskId: string | null;
      filename: string;
      mime: string;
      size: number;
      storageKey: string;
    }>(req);

    const created = await inTenant(tenant, async (tx, ctx) => {
      const p = await loadProject(tx, ctx, str(b.projectId, 'projectId'));
      requireProjectWrite(p);
      const filename = str(b.filename, 'filename');
      const mime = str(b.mime, 'mime');
      checkUpload(filename, mime, Number(b.size));
      return recordAttachment(tx, ctx.tenantId, {
        projectId: p.projectId,
        taskId: b.taskId ?? null,
        filename,
        mimeType: mime,
        sizeBytes: Number(b.size),
        storageKey: str(b.storageKey, 'storageKey'),
        uploadedBy: ctx.userId,
      });
    });
    return ok(created);
  });
}
