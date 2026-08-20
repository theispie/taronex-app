/**
 * รูปแบบข้อผิดพลาดของ API — ยกจาก docs/taronex-architecture.html หัวข้อ
 * "รูปแบบคำตอบและข้อผิดพลาด" ตรงๆ ห้ามคิดรหัสใหม่โดยไม่เติมลงตารางนี้
 *
 * กติกาที่สำคัญที่สุดในไฟล์นี้ — ข้ามที่ทำงานต้องตอบ 404 ไม่ใช่ 403
 * เพราะ 403 เป็นการยืนยันว่าข้อมูลนั้นมีอยู่จริง
 */

export type ErrorCode =
  // 400 ข้อมูลที่ส่งมาไม่ถูกรูปแบบ
  | 'E_INVALID'
  | 'E_COLUMN_NOT_PATCHABLE'
  // 401 ยังไม่ได้เข้าสู่ระบบ
  | 'E_UNAUTHENTICATED'
  | 'E_SESSION_EXPIRED'
  // 402 เกินโควตาหรือถูกระงับ
  | 'E_QUOTA_EXCEEDED'
  | 'E_TENANT_SUSPENDED'
  | 'E_PAST_DUE'
  // 403 ไม่มีสิทธิ์
  | 'E_FORBIDDEN'
  | 'E_PM_ONLY'
  | 'E_OWNER_ONLY'
  | 'E_READ_ONLY'
  // 404 ไม่พบ หรืออยู่คนละ tenant
  | 'E_NOT_FOUND'
  // 409 ชนกัน
  | 'E_CONFLICT'
  | 'E_KEY_TAKEN'
  // 422 ผิดกติกาทางธุรกิจ
  | 'E_UNPROCESSABLE'
  | 'E_REASON_REQUIRED'
  | 'E_LAST_OWNER'
  | 'E_STILL_PM'
  | 'E_COLUMN_COUNT'
  // 429 เรียกถี่เกินไป
  | 'E_RATE_LIMITED';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  E_INVALID: 400,
  E_COLUMN_NOT_PATCHABLE: 400,
  E_UNAUTHENTICATED: 401,
  E_SESSION_EXPIRED: 401,
  E_QUOTA_EXCEEDED: 402,
  E_TENANT_SUSPENDED: 402,
  E_PAST_DUE: 402,
  E_FORBIDDEN: 403,
  E_PM_ONLY: 403,
  E_OWNER_ONLY: 403,
  E_READ_ONLY: 403,
  E_NOT_FOUND: 404,
  E_CONFLICT: 409,
  E_KEY_TAKEN: 409,
  E_UNPROCESSABLE: 422,
  E_REASON_REQUIRED: 422,
  E_LAST_OWNER: 422,
  E_STILL_PM: 422,
  E_COLUMN_COUNT: 422,
  E_RATE_LIMITED: 429,
};

/** ข้อความเริ่มต้นภาษาไทย — ยกถ้อยคำจากต้นแบบ ไม่แปลใหม่ */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  E_INVALID: 'ข้อมูลที่ส่งมาไม่ถูกรูปแบบ',
  E_COLUMN_NOT_PATCHABLE: 'ย้ายคอลัมน์ด้วย PATCH ไม่ได้ ต้องใช้ POST /tasks/:id/transition',
  E_UNAUTHENTICATED: 'ยังไม่ได้เข้าสู่ระบบ',
  E_SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่',
  E_QUOTA_EXCEEDED: 'โควตาเต็ม',
  E_TENANT_SUSPENDED: 'ที่ทำงานนี้ถูกระงับชั่วคราว',
  E_PAST_DUE: 'ค้างชำระ',
  E_FORBIDDEN: 'ไม่มีสิทธิ์',
  E_PM_ONLY: 'ปิดงานได้เฉพาะ PM ของโปรเจกต์',
  E_OWNER_ONLY: 'เจ้าของที่ทำงานเท่านั้นที่ทำรายการนี้ได้',
  E_READ_ONLY: 'โปรเจกต์นี้คุณเข้าดูได้อย่างเดียว',
  E_NOT_FOUND: 'ไม่พบ',
  E_CONFLICT: 'ข้อมูลชนกัน',
  E_KEY_TAKEN: 'รหัสนี้ถูกใช้ไปแล้ว',
  E_UNPROCESSABLE: 'ทำรายการนี้ไม่ได้',
  E_REASON_REQUIRED: 'ตีกลับต้องใส่เหตุผล',
  E_LAST_OWNER: 'ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคน',
  E_STILL_PM: 'ยังเป็น PM ของโปรเจกต์อยู่ ต้องเลือกคนรับช่วงก่อน',
  E_COLUMN_COUNT: 'คอลัมน์ตั้งได้ 2–8 คอลัมน์',
  E_RATE_LIMITED: 'เรียกถี่เกินไป',
};

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; field: string | null };
}

/** ข้อผิดพลาดที่ตั้งใจโยน — ตัวห่อ handler จะแปลงเป็นคำตอบ JSON ให้เอง */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly field: string | null;

  constructor(code: ErrorCode, message?: string, field?: string) {
    super(message ?? ERROR_MESSAGE[code]);
    this.name = 'ApiError';
    this.code = code;
    this.field = field ?? null;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message, field: this.field } };
  }
}

/**
 * ใช้แทน 403 ทุกครั้งที่ทรัพยากรอาจอยู่คนละที่ทำงาน
 * มีชื่อฟังก์ชันแยกเพื่อให้อ่านโค้ดแล้วเห็นเจตนา และให้ grep หาได้ตอนรีวิว
 */
export function notFoundAcrossTenant(): ApiError {
  return new ApiError('E_NOT_FOUND');
}
