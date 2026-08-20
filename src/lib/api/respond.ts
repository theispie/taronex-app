/**
 * รูปแบบคำตอบของ API และตัวห่อ handler
 *
 * สำเร็จ  { "data": …, "meta": { "page": 1, "total": 128 } }
 * ผิดพลาด { "error": { "code": …, "message": …, "field": … } }
 *
 * ตอนต่อฐานข้อมูลจริง (M1) ตัวห่อในไฟล์นี้คือที่ที่จะเพิ่ม
 * set_config('app.tenant_id', …, true) ให้ทุกธุรกรรม — กฎข้อ 2 และ 3
 * ห้ามให้ route ไหนเปิดธุรกรรมเองนอกทางนี้
 */

import { ApiError } from './errors';

export interface PageMeta {
  page: number;
  total: number;
}

export function ok<T>(data: T, meta?: PageMeta): Response {
  return Response.json(meta ? { data, meta } : { data });
}

export function fail(err: ApiError): Response {
  return Response.json(err.toBody(), { status: err.status });
}

/**
 * ห่อ handler ให้ข้อผิดพลาดออกมาเป็นรูปแบบเดียวกันเสมอ
 * ข้อผิดพลาดที่ไม่ได้ตั้งใจจะกลายเป็น 500 ที่ไม่บอกรายละเอียดออกไปข้างนอก
 */
export function handler(fn: () => Promise<Response> | Response): () => Promise<Response> {
  return async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError) return fail(e);
      return Response.json(
        { error: { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null } },
        { status: 500 },
      );
    }
  };
}
