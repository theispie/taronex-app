/**
 * เกณฑ์ผ่านของ M10 ข้อแรก
 *   แจ้งบ่าย 3 วันศุกร์ SLA 8 ชม. → ครบกำหนดบ่าย 2 วันจันทร์
 *
 * เทสต์ชุดนี้ไม่แตะฐานข้อมูลเลย เป็นเลขล้วน จึงรันเร็วและอ่านง่าย
 * เวลาทั้งหมดเขียนเป็น +07:00 ตรงๆ เพื่อให้อ่านแล้วเห็นภาพทันที
 */

import { describe, expect, it } from 'vitest';
import {
  addBusinessMinutes,
  businessMinutesBetween,
  DEFAULT_HOURS,
  nextBusinessStart,
} from './business-hours';

/** เวลาไทยเขียนตรงๆ อ่านง่ายกว่าคิด UTC ในหัว */
const th = (s: string) => new Date(`${s}+07:00`);
const fmt = (d: Date) =>
  new Date(d.getTime() + 7 * 3_600_000).toISOString().replace('T', ' ').slice(0, 16);

describe('เกณฑ์ผ่าน · ศุกร์บ่าย 3 + 8 ชม. = จันทร์บ่าย 2', () => {
  it('ข้ามเสาร์อาทิตย์ให้ถูกต้อง', () => {
    // 2026-08-21 เป็นวันศุกร์
    const reported = th('2026-08-21T15:00:00');
    const due = addBusinessMinutes(reported, 8 * 60, DEFAULT_HOURS);
    expect(fmt(due), 'ศุกร์ 15:00→18:00 = 3 ชม. · จันทร์ 09:00 + 5 ชม. = 14:00').toBe(
      '2026-08-24 14:00',
    );
  });

  it('นับเวลาทำการระหว่างสองจุดได้ตรงกัน', () => {
    const a = th('2026-08-21T15:00:00');
    const b = th('2026-08-24T14:00:00');
    expect(businessMinutesBetween(a, b, DEFAULT_HOURS)).toBe(8 * 60);
  });
});

describe('นอกเวลาทำการ', () => {
  it('แจ้งตอนตีสอง นาฬิกาเริ่มนับ 09:00 วันเดียวกัน (ถ้าเป็นวันทำงาน)', () => {
    // 2026-08-19 เป็นวันพุธ
    const at = th('2026-08-19T02:00:00');
    expect(fmt(nextBusinessStart(at, DEFAULT_HOURS))).toBe('2026-08-19 09:00');
  });

  it('แจ้งหลังเลิกงาน เริ่มนับเช้าวันทำการถัดไป', () => {
    const at = th('2026-08-19T20:00:00');
    expect(fmt(nextBusinessStart(at, DEFAULT_HOURS))).toBe('2026-08-20 09:00');
  });

  it('แจ้งวันเสาร์ เริ่มนับเช้าวันจันทร์', () => {
    // 2026-08-22 เป็นวันเสาร์
    const at = th('2026-08-22T10:00:00');
    expect(fmt(nextBusinessStart(at, DEFAULT_HOURS))).toBe('2026-08-24 09:00');
  });

  it('เวลานอกเวลาทำการไม่ถูกนับรวม', () => {
    // พุธ 17:00 → พฤหัส 10:00 = 1 ชม. (17-18) + 1 ชม. (9-10)
    const a = th('2026-08-19T17:00:00');
    const b = th('2026-08-20T10:00:00');
    expect(businessMinutesBetween(a, b, DEFAULT_HOURS)).toBe(120);
  });

  it('ทั้งเสาร์อาทิตย์นับเป็นศูนย์', () => {
    const a = th('2026-08-22T00:00:00');
    const b = th('2026-08-24T00:00:00');
    expect(businessMinutesBetween(a, b, DEFAULT_HOURS)).toBe(0);
  });
});

describe('วันหยุดราชการไทย', () => {
  it('ข้ามวันแม่ (12 ส.ค.)', () => {
    // 2026-08-12 เป็นวันพุธและเป็นวันหยุด
    const at = th('2026-08-11T17:00:00');
    const due = addBusinessMinutes(at, 2 * 60, DEFAULT_HOURS);
    expect(fmt(due), 'อังคาร 17:00→18:00 = 1 ชม. · ข้ามวันพุธที่หยุด · พฤหัส 09:00 + 1 ชม.').toBe(
      '2026-08-13 10:00',
    );
  });

  it('ปิดวันหยุดได้ถ้าที่ทำงานไม่ได้อยู่ไทย', () => {
    const at = th('2026-08-11T17:00:00');
    const due = addBusinessMinutes(at, 2 * 60, { ...DEFAULT_HOURS, holidays: 'none' });
    expect(fmt(due), 'ไม่ข้ามวันพุธ เพราะไม่ได้ใช้ตารางวันหยุดไทย').toBe('2026-08-12 10:00');
  });
});

describe('ตั้งเวลาทำการเอง', () => {
  it('ที่ทำงานที่ทำงานหกวันและเลิกสี่ทุ่ม', () => {
    const hours = { days: [1, 2, 3, 4, 5, 6], start: '10:00', end: '22:00', holidays: 'none' };
    // เสาร์ 2026-08-22 เวลา 20:00 + 4 ชม. → เสาร์เหลือ 2 ชม. · จันทร์ 10:00 + 2 = 12:00
    const due = addBusinessMinutes(th('2026-08-22T20:00:00'), 4 * 60, hours);
    expect(fmt(due)).toBe('2026-08-24 12:00');
  });

  it('ตั้งวันทำการเป็นชุดว่างแล้วไม่ค้างเป็นลูปไม่รู้จบ', () => {
    const hours = { days: [], start: '09:00', end: '18:00', holidays: 'none' };
    const due = addBusinessMinutes(th('2026-08-21T15:00:00'), 60, hours);
    expect(due).toBeInstanceOf(Date);
  });
});

describe('กรณีขอบ', () => {
  it('ศูนย์นาทีคืนต้นเวลาทำการถัดไป ไม่ใช่เวลาเดิม', () => {
    const at = th('2026-08-22T10:00:00');
    expect(fmt(addBusinessMinutes(at, 0, DEFAULT_HOURS))).toBe('2026-08-24 09:00');
  });

  it('ปลายทางก่อนต้นทาง คืนศูนย์ ไม่ใช่ค่าติดลบ', () => {
    const a = th('2026-08-24T10:00:00');
    const b = th('2026-08-21T10:00:00');
    expect(businessMinutesBetween(a, b, DEFAULT_HOURS)).toBe(0);
  });

  it('ข้ามหลายสัปดาห์ยังถูก', () => {
    // ศุกร์ 09:00 + 45 ชม. = 5 วันทำการ (9 ชม./วัน)
    const due = addBusinessMinutes(th('2026-08-21T09:00:00'), 45 * 60, DEFAULT_HOURS);
    expect(fmt(due), 'ศุกร์เต็มวัน + จ-พฤ อีก 4 วัน').toBe('2026-08-27 18:00');
  });
});
