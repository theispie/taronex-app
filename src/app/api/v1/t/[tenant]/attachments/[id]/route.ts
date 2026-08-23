import { inTenant } from '@/lib/api/context';
import { handle } from '@/lib/api/handle';
import { loadProject, requireProjectWrite } from '@/lib/api/project-access';
import { ok } from '@/lib/api/respond';
import { deleteObject } from '@/lib/storage';
import { getAttachment, removeAttachment } from '@/lib/tasks';

/**
 * DELETE — ลบแถวก่อน แล้วค่อยลบไฟล์จริง
 * ถ้าลบไฟล์จริงพลาด แถวหายไปแล้วก็ยังดีกว่าเหลือแถวที่ชี้ไปไฟล์ที่ไม่มี
 * ไฟล์กำพร้าเก็บกวาดทีหลังได้ แต่แถวที่กดแล้วดาวน์โหลดไม่ได้ทำให้คนสับสน
 */
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tenant: string; id: string }> },
): Promise<Response> {
  return handle(async () => {
    const { tenant, id } = await params;
    const removed = await inTenant(tenant, async (tx, ctx) => {
      const found = await getAttachment(tx, id);
      requireProjectWrite(await loadProject(tx, ctx, found.projectId));
      return removeAttachment(tx, id);
    });
    if (removed.storageKey) {
      await deleteObject(removed.storageKey).catch(() => {
        // ไฟล์กำพร้าไม่ใช่เรื่องที่ต้องทำให้คำขอล้มเหลว
      });
    }
    return ok({ ok: true });
  });
}
