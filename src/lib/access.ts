/**
 * กฎข้อ 10 — ตัดสินสิทธิ์ที่เดียว
 * ทุก route และทุกคอมโพเนนต์ต้องเรียกฟังก์ชันนี้ ห้ามตรวจสิทธิ์เอง
 *
 * ตอนนี้ยังไม่มีฐานข้อมูล จึงรับข้อมูลเข้ามาเป็นพารามิเตอร์
 * ตอนต่อ backend ให้เปลี่ยนแค่ที่มาของข้อมูล ตรรกะข้างในคงเดิม
 */

export type MembershipRole = 'owner' | 'member' | 'viewer' | 'guest';
export type ProjectMemberAccess = 'collaborate' | 'read_only';
export type Access = 'none' | 'read' | 'write';

export interface AccessInput {
  role: MembershipRole;
  /** ค่าเริ่มต้นระดับโปรเจกต์ */
  projectAccess: ProjectMemberAccess;
  /** รายชื่อยกเว้นรายคน (ตาราง project_members) — undefined = ไม่มีแถวยกเว้น */
  override?: 'read' | 'write';
  /** ผู้ใช้คนนี้เป็น PM ของโปรเจกต์นี้หรือไม่ */
  isPm: boolean;
}

export function resolveAccess(input: AccessInput): Access {
  // แขกเห็นเฉพาะโปรเจกต์ที่ถูกเชิญเข้ามาโดยตรงเท่านั้น
  if (input.role === 'guest') return input.override ?? 'none';
  // ผู้ชมอ่านได้ทุกโปรเจกต์ แต่เขียนไม่ได้เลย ไม่ว่าจะตั้งค่าอะไรไว้
  if (input.role === 'viewer') return 'read';
  // PM และเจ้าของเขียนได้เสมอ
  if (input.isPm || input.role === 'owner') return 'write';
  // สมาชิกทั่วไป: ใช้รายชื่อยกเว้นก่อน แล้วค่อยตกไปที่ค่าเริ่มต้นของโปรเจกต์
  return input.override ?? (input.projectAccess === 'collaborate' ? 'write' : 'read');
}

export function canWrite(a: Access): boolean {
  return a === 'write';
}
