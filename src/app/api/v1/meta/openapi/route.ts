import { buildOpenApi } from '@/lib/api/openapi';

/**
 * GET /api/v1/meta/openapi — สเปค OpenAPI 3.1 ของทั้งระบบ
 *
 * นำเข้า Postman / Insomnia / Bruno ได้ตรงๆ ด้วย URL นี้
 * และชี้ Swagger UI มาที่นี่ได้โดยไม่ต้องติดตั้งอะไรลงเครื่อง
 *
 * server url อ่านจาก Host ของ request เพื่อไม่ต้องฝังชื่อโดเมนไว้ในโค้ด
 */
export const dynamic = 'force-dynamic';

export function GET(req: Request): Response {
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const spec = buildOpenApi(`${proto}://${host}/app/api/v1`);
  return Response.json(spec, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
