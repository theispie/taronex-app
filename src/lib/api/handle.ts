import { ApiError } from './errors';
import { fail } from './respond';

/**
 * ห่อ handler ให้ข้อผิดพลาดออกมารูปแบบเดียวกันเสมอ
 * ข้อผิดพลาดที่ไม่ได้ตั้งใจกลายเป็น 500 ที่ไม่บอกรายละเอียดออกไปข้างนอก
 * เพราะข้อความจากฐานข้อมูลมักมีชื่อตารางและคอลัมน์ปนมา
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return fail(e);
    console.error('[api]', e);
    return Response.json(
      { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
      { status: 500 },
    );
  }
}

/** อ่าน JSON body แบบไม่โยนเมื่อ body ว่างหรือไม่ใช่ JSON */
export async function body<T>(req: Request): Promise<Partial<T>> {
  return (await req.json().catch(() => ({}))) as Partial<T>;
}

export function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new ApiError('E_INVALID', 'กรอกข้อมูลให้ครบ', field);
  }
  return v;
}
