'use client';

/**
 * ตัวเรียก API ฝั่งเบราว์เซอร์
 *
 * แกะรูปแบบคำตอบให้เหลือแต่ data และแปลง error เป็นข้อความไทยที่แสดงได้เลย
 * ทุกหน้าจอใช้ตัวนี้ ไม่เรียก fetch เอง จะได้จัดการ error เหมือนกันหมดทั้งระบบ
 */

const BASE = '/app/api/v1';

export interface ApiFailure {
  code: string;
  message: string;
  field: string | null;
}

export class ApiCallError extends Error {
  readonly code: string;
  readonly field: string | null;
  readonly status: number;

  constructor(status: number, f: ApiFailure) {
    super(f.message);
    this.name = 'ApiCallError';
    this.code = f.code;
    this.field = f.field;
    this.status = status;
  }
}

async function call<T>(method: string, path: string, payload?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: payload === undefined ? undefined : { 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: 'no-store',
  });

  let parsed: { data?: T; error?: ApiFailure } = {};
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new ApiCallError(res.status, {
      code: 'E_INTERNAL',
      message: 'ระบบไม่ตอบกลับ ลองอีกครั้ง',
      field: null,
    });
  }

  if (!res.ok || parsed.error) {
    throw new ApiCallError(
      res.status,
      parsed.error ?? { code: 'E_INTERNAL', message: 'ระบบขัดข้อง', field: null },
    );
  }
  return parsed.data as T;
}

export const api = {
  get: <T>(p: string) => call<T>('GET', p),
  post: <T>(p: string, b?: unknown) => call<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b?: unknown) => call<T>('PATCH', p, b ?? {}),
  del: <T>(p: string) => call<T>('DELETE', p),
};

/** ข้อความที่แสดงได้เลย — ไม่ต้องแปลรหัสข้อผิดพลาดซ้ำในทุกหน้า */
export function errorText(e: unknown): string {
  if (e instanceof ApiCallError) return e.message;
  if (e instanceof Error) return e.message;
  return 'เกิดข้อผิดพลาดที่ไม่คาดคิด';
}
