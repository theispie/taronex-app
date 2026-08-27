import { describe, expect, it } from 'vitest';
import {
  type BoardColumn,
  checkMove,
  columnRole,
  columnTone,
  isClosed,
  taskCode,
  validateColumns,
} from './types';

const cols = (n: number): BoardColumn[] =>
  Array.from({ length: n }, (_, i) => ({ key: `c${i}`, name: `คอลัมน์ ${i}` }));

/**
 * กฎข้อ 8 — คอลัมน์มีแค่ชื่อกับลำดับ กติกาคำนวณสดจากตำแหน่งและทิศทางการลาก
 * ถ้าเทสต์ชุดนี้แดง แปลว่ามีคนเผลอเอาการตั้งค่ากลับเข้าไปในคอลัมน์
 */
describe('ตำแหน่งคอลัมน์', () => {
  it('คอลัมน์แรกและสุดท้ายรู้ตัวเองจากลำดับ ไม่ใช่จากธง', () => {
    expect(columnRole(0, 4)).toBe('first');
    expect(columnRole(3, 4)).toBe('last');
    expect(columnRole(1, 4)).toBe('middle');
  });

  it('บอร์ด 2 คอลัมน์ไม่มีคอลัมน์กลาง', () => {
    expect(columnRole(0, 2)).toBe('first');
    expect(columnRole(1, 2)).toBe('last');
  });

  it('สีคำนวณจากตำแหน่ง ไม่ได้เก็บไว้', () => {
    expect(columnTone(0, 4)).toBe('todo');
    expect(columnTone(3, 4)).toBe('done');
    expect(columnTone(2, 4)).toBe('review');
    expect(columnTone(1, 4)).toBe('doing');
  });
});

describe('validateColumns', () => {
  it('ผ่านเมื่ออยู่ในช่วง 2–8 คอลัมน์', () => {
    expect(validateColumns(cols(2))).toEqual([]);
    expect(validateColumns(cols(8))).toEqual([]);
  });

  it('ปฏิเสธน้อยกว่า 2 และมากกว่า 8', () => {
    expect(validateColumns(cols(1))).toHaveLength(1);
    expect(validateColumns(cols(9))).toHaveLength(1);
  });

  it('ปฏิเสธชื่อซ้ำและชื่อว่าง', () => {
    expect(
      validateColumns([
        { key: 'a', name: 'ทำ' },
        { key: 'b', name: 'ทำ' },
      ]),
    ).toHaveLength(1);
    expect(
      validateColumns([
        { key: 'a', name: 'ทำ' },
        { key: 'b', name: '   ' },
      ]).length,
    ).toBeGreaterThan(0);
  });
});

describe('checkMove — ทิศทางการลากเป็นตัวตัดสิน', () => {
  it('ลากถอยหลังคือตีกลับ — ย้ายได้เลย ไม่บังคับเหตุผล', () => {
    const m = checkMove(2, 1, 4);
    expect(m.kind).toBe('backward');
    expect(m.pmOnly).toBe(false);
  });

  it('ลากเข้าคอลัมน์สุดท้ายคือปิดงาน PM เท่านั้น', () => {
    const m = checkMove(1, 3, 4);
    expect(m.kind).toBe('close');
    expect(m.pmOnly).toBe(true);
  });

  it('ปิดงานมาก่อนการตีกลับ แม้ลากถอยหลังมาเข้าคอลัมน์สุดท้าย', () => {
    // บอร์ด 2 คอลัมน์: ลากจาก index 1 ไป 1 ไม่เกิดขึ้นจริง แต่ทดสอบว่ากติกาปิดงานชนะ
    expect(checkMove(3, 3, 4).kind).toBe('close');
  });

  it('ลากไปข้างหน้าปกติ ไม่ใช่ PM ก็ทำได้', () => {
    const m = checkMove(0, 1, 4);
    expect(m.kind).toBe('forward');
    expect(m.pmOnly).toBe(false);
  });
});

describe('สถานะปิดงานอ่านจากตำแหน่ง', () => {
  it('อยู่คอลัมน์สุดท้าย = ปิด', () => {
    const b = cols(4);
    expect(isClosed({ columnKey: 'c3' }, b)).toBe(true);
    expect(isClosed({ columnKey: 'c0' }, b)).toBe(false);
  });

  it('คอลัมน์ที่ไม่รู้จักถือว่าอยู่คอลัมน์แรก ไม่ใช่ปิดงาน', () => {
    expect(isClosed({ columnKey: 'ไม่มีคอลัมน์นี้' }, cols(4))).toBe(false);
  });
});

describe('taskCode', () => {
  it('ประกอบรหัสที่ใช้อ้างกันในไลน์', () => {
    expect(taskCode({ projectKey: 'ACM', number: 138 })).toBe('ACM-138');
  });
});
