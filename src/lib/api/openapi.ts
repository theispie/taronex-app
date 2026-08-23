/**
 * แปลงทะเบียนเป็น OpenAPI 3.1
 *
 * เหตุผลที่ทำทางนี้แทนการติดตั้ง Swagger — ทะเบียนใน registry.ts เป็นแหล่งความจริงอยู่แล้ว
 * ถ้าไปเขียนสเปคแยกอีกไฟล์ วันหนึ่งมันจะไม่ตรงกันแล้วไม่มีใครรู้ว่าอันไหนถูก
 * สเปคที่สร้างจากทะเบียนจึงเก่าไม่ได้โดยธรรมชาติ
 *
 * ไฟล์นี้ไม่ต้องใช้ไลบรารีใดๆ และไม่กิน RAM ตอนรัน — สร้าง object แล้วตอบเป็น JSON
 * Postman · Insomnia · Bruno · Swagger UI นำเข้าไฟล์นี้ได้ทุกตัว
 */

import { ALL_ENDPOINTS, type Endpoint, GROUPS, servedPath } from './registry';

interface OpenApiParam {
  name: string;
  in: 'path';
  required: true;
  schema: { type: 'string' };
}

interface OpenApiOperation {
  operationId: string;
  summary: string;
  tags: string[];
  description?: string;
  parameters?: OpenApiParam[];
  responses: Record<string, { description: string }>;
  security?: Record<string, string[]>[];
  deprecated?: boolean;
}

/** /tasks/:id/comments → /tasks/{id}/comments */
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** รับทั้ง :name (รูปแบบในทะเบียน) และ {name} (รูปแบบที่ servedPath ใส่มาแล้ว) */
function pathParams(path: string): OpenApiParam[] {
  const names = [...path.matchAll(/:([A-Za-z0-9_]+)|\{([A-Za-z0-9_]+)\}/g)].map(
    (m) => (m[1] ?? m[2]) as string,
  );
  return names.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } }));
}

/** POST /tasks/:id/transition → postTasksIdTransition */
function operationId(e: Endpoint): string {
  const parts = e.path
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/^:/, ''))
    .map(
      (p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()),
    );
  return e.method.toLowerCase() + parts.join('');
}

/** ชื่อ security scheme ตามขอบเขต — พอร์ทัลใช้คุกกี้คนละตัวตามกฎข้อ 6 */
function securityFor(e: Endpoint): Record<string, string[]>[] | undefined {
  if (e.scope === 'public' || e.scope === 'meta') return undefined;
  if (e.scope === 'portal') return [{ portalSession: [] }];
  return [{ teamSession: [] }];
}

function describe(e: Endpoint): string {
  const lines: string[] = [];
  lines.push(
    `**สถานะ** ${e.status === 'live' ? 'ใช้ได้แล้ว' : e.status === 'partial' ? 'ทำบางส่วน' : 'ยังไม่ทำ'}`,
  );
  lines.push(`**หมุดหมาย** ${e.milestone}`);
  lines.push(`**ขอบเขต** ${e.scope}`);
  if (e.access) lines.push(`**สิทธิ์ที่ต้องมี** ${e.access === 'write' ? 'เขียน' : 'อ่าน'}`);
  if (e.rules?.length) lines.push(`**กฎที่ต้องบังคับ** ข้อ ${e.rules.join(', ')}`);
  if (e.crossTenant) lines.push('**ข้าม tenant ได้** — อยู่ในรายชื่ออนุญาตตามกฎข้อ 11');
  if (e.note) lines.push(`**หมายเหตุ** ${e.note}`);
  return lines.join('\n\n');
}

/** คำตอบผิดพลาดที่ทุก endpoint มีโอกาสตอบ */
function responsesFor(e: Endpoint): Record<string, { description: string }> {
  const r: Record<string, { description: string }> = {
    '200': { description: 'สำเร็จ — { data, meta? }' },
  };
  if (e.scope !== 'public' && e.scope !== 'meta') {
    r['401'] = { description: 'ยังไม่ได้เข้าสู่ระบบ' };
    r['404'] = { description: 'ไม่พบ หรืออยู่คนละ tenant — ใช้ 404 ไม่ใช่ 403 โดยตั้งใจ' };
  }
  if (e.access === 'write') r['403'] = { description: 'ไม่มีสิทธิ์เขียน' };
  if (e.method !== 'GET') {
    r['400'] = { description: 'ข้อมูลที่ส่งมาไม่ถูกรูปแบบ' };
    r['422'] = { description: 'ผิดกติกาทางธุรกิจ' };
  }
  return r;
}

export function buildOpenApi(serverUrl: string): Record<string, unknown> {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const group of GROUPS) {
    for (const e of group.endpoints) {
      // ใช้เส้นทางจริงที่เสิร์ฟ ไม่ใช่เส้นทางเชิงตรรกะในทะเบียน
      const served = servedPath(e);
      const p = toOpenApiPath(served);
      const params = pathParams(served);
      const op: OpenApiOperation = {
        operationId: operationId(e),
        summary: e.summary || e.path,
        tags: [group.name],
        description: describe(e),
        responses: responsesFor(e),
      };
      if (params.length > 0) op.parameters = params;
      const sec = securityFor(e);
      if (sec) op.security = sec;
      if (!paths[p]) paths[p] = {};
      (paths[p] as Record<string, OpenApiOperation>)[e.method.toLowerCase()] = op;
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'TaroNex API',
      version: '1.0.0-draft',
      description: [
        'สเปคนี้สร้างจาก `src/lib/api/registry.ts` อัตโนมัติ — ห้ามแก้ที่นี่ ให้แก้ที่ทะเบียน',
        '',
        `ตอนนี้มี ${ALL_ENDPOINTS.length} เส้นทาง ใช้ได้จริงแล้ว ` +
          `${ALL_ENDPOINTS.filter((e) => e.status === 'live').length} เส้นทาง ` +
          'ที่เหลือยังเป็นสัญญาที่ตกลงกันไว้ ยังเรียกไม่ได้',
        '',
        'ยืนยันตัวตนด้วย session cookie แบบ httpOnly · ฝั่งทีมกับพอร์ทัลลูกค้าใช้คุกกี้คนละตัวโดยตั้งใจ',
      ].join('\n'),
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        teamSession: { type: 'apiKey', in: 'cookie', name: 'tnx_session' },
        portalSession: { type: 'apiKey', in: 'cookie', name: 'tnx_portal' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message', 'field'],
              properties: {
                code: { type: 'string', examples: ['E_PM_ONLY'] },
                message: { type: 'string', examples: ['ปิดงานได้เฉพาะ PM ของโปรเจกต์'] },
                field: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    tags: GROUPS.map((g) => ({ name: g.name })),
    paths,
  };
}
