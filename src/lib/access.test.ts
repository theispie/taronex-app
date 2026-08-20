import { describe, expect, it } from 'vitest';
import { type AccessInput, resolveAccess } from './access';

/**
 * กฎข้อ 10 — ตัดสินสิทธิ์ที่เดียว
 * เทสต์ชุดนี้เน้นเส้นทางที่ "ไม่ควรได้สิทธิ์" มากกว่าเส้นทางที่ได้
 * เพราะความผิดพลาดด้านสิทธิ์ที่อันตรายคือการให้เกิน ไม่ใช่การให้ขาด
 */
const base: AccessInput = {
  role: 'member',
  projectAccess: 'collaborate',
  isPm: false,
};

describe('resolveAccess', () => {
  it('แขกที่ไม่มีรายชื่อยกเว้น เข้าไม่ได้เลย', () => {
    expect(resolveAccess({ ...base, role: 'guest' })).toBe('none');
  });

  it('แขกเห็นเฉพาะโปรเจกต์ที่ถูกเชิญเข้ามาโดยตรง', () => {
    expect(resolveAccess({ ...base, role: 'guest', override: 'read' })).toBe('read');
    expect(resolveAccess({ ...base, role: 'guest', override: 'write' })).toBe('write');
  });

  it('แขกไม่ได้สิทธิ์จากค่าเริ่มต้นของโปรเจกต์ แม้โปรเจกต์เปิดให้ร่วมงาน', () => {
    expect(resolveAccess({ ...base, role: 'guest', projectAccess: 'collaborate' })).toBe('none');
  });

  it('ผู้ชมเขียนไม่ได้เลย ไม่ว่าตั้งค่าอะไรไว้', () => {
    expect(resolveAccess({ ...base, role: 'viewer', projectAccess: 'collaborate' })).toBe('read');
    expect(resolveAccess({ ...base, role: 'viewer', override: 'write' })).toBe('read');
    expect(resolveAccess({ ...base, role: 'viewer', isPm: true })).toBe('read');
  });

  it('เจ้าของและ PM เขียนได้เสมอ แม้โปรเจกต์ตั้งเป็นอ่านอย่างเดียว', () => {
    expect(resolveAccess({ ...base, role: 'owner', projectAccess: 'read_only' })).toBe('write');
    expect(resolveAccess({ ...base, isPm: true, projectAccess: 'read_only' })).toBe('write');
  });

  it('สมาชิกทั่วไปตกไปที่ค่าเริ่มต้นของโปรเจกต์เมื่อไม่มีรายชื่อยกเว้น', () => {
    expect(resolveAccess({ ...base, projectAccess: 'collaborate' })).toBe('write');
    expect(resolveAccess({ ...base, projectAccess: 'read_only' })).toBe('read');
  });

  it('รายชื่อยกเว้นรายคนชนะค่าเริ่มต้นของโปรเจกต์ ทั้งขาขึ้นและขาลง', () => {
    expect(resolveAccess({ ...base, projectAccess: 'read_only', override: 'write' })).toBe('write');
    expect(resolveAccess({ ...base, projectAccess: 'collaborate', override: 'read' })).toBe('read');
  });
});
