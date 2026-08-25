/**
 * อักษรย่อบนรูปโปรไฟล์ — ล้มกลับสามชั้น
 *
 * ทดสอบเป็นเทสต์หน่วยไม่ใช่เทสต์เบราว์เซอร์ เพราะชั้นสุดท้าย (ตกไปใช้อีเมล)
 * เกิดขึ้นไม่ได้ผ่านหน้าเว็บจริง — เซิร์ฟเวอร์ไม่ยอมให้ชื่อว่าง
 * แต่โค้ดยังต้องรับมือได้ เผื่อข้อมูลเก่าหรือการนำเข้าจากที่อื่นในอนาคต
 */

import { describe, expect, it } from 'vitest';
import { initialsOf } from './account-menu';

describe('initialsOf()', () => {
  it('มีชื่อ → เอาสองอักษรแรกของคำแรก', () => {
    expect(initialsOf({ name: 'พีรพล วงศ์สถาพร', email: 'x@a.co' })).toBe('พี');
    expect(initialsOf({ name: 'สมชาย', email: 'x@a.co' })).toBe('สม');
  });

  it('ชื่อภาษาอังกฤษก็เอาสองตัวแรกของคำแรกเหมือนกัน', () => {
    expect(initialsOf({ name: 'Peerapon Wong', email: 'x@a.co' })).toBe('Pe');
  });

  it('ชื่อมีช่องว่างหน้าหลัง → ตัดทิ้งก่อน', () => {
    expect(initialsOf({ name: '  สมหญิง  ', email: 'x@a.co' })).toBe('สม');
  });

  it('ไม่มีชื่อ → ตกไปใช้อีเมล', () => {
    expect(initialsOf({ name: '', email: 'peerapon@digitalx.co.th' })).toBe('pe');
    expect(initialsOf({ name: '   ', email: 'bee@digitalx.co.th' })).toBe('be');
    expect(initialsOf({ name: null, email: 'korn@digitalx.co.th' })).toBe('ko');
    expect(initialsOf({ email: 'nut@digitalx.co.th' })).toBe('nu');
  });

  it('ชื่อคำเดียวตัวอักษรเดียว → คืนตัวเดียว ไม่พัง', () => {
    expect(initialsOf({ name: 'ก', email: 'x@a.co' })).toBe('ก');
  });
});
