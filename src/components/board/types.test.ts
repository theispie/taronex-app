import { describe, expect, it } from 'vitest';
import { columnTone, dropColumnKey, dropIndex, positionBetween } from './types';

/**
 * ⭐ บั๊กที่เทสต์นี้กันไม่ให้กลับมา
 *
 * บอร์ดลากข้ามคอลัมน์ไม่ได้ เพราะ dnd-kit คืน `over` เป็น id ของ **การ์ด**
 * ที่อยู่ใต้เมาส์ ไม่ใช่ `col:xxx` ของคอลัมน์ โค้ดเดิมมองว่าไม่ใช่คอลัมน์แล้วเงียบ
 *
 * เทสต์ e2e เดิมไม่จับ เพราะมันหย่อนที่ "พื้นที่ว่าง" ของคอลัมน์เสมอ
 * ซึ่งเป็นเคสเดียวที่ยังทำงานอยู่ — คอลัมน์ที่การ์ดเต็มไม่มีที่ว่างให้โดนเลย
 */
const tasks = [
  { id: 'aaa', columnKey: 'todo' },
  { id: 'bbb', columnKey: 'doing' },
  { id: 'ccc', columnKey: 'done' },
];

describe('dropColumnKey', () => {
  it('หย่อนที่พื้นที่ว่างของคอลัมน์ → ได้คีย์คอลัมน์นั้น', () => {
    expect(dropColumnKey('col:doing', tasks)).toBe('doing');
    expect(dropColumnKey('col:done', tasks)).toBe('done');
  });

  it('⭐ หย่อนทับการ์ดใบอื่น → ได้คอลัมน์ของการ์ดใบนั้น', () => {
    expect(dropColumnKey('bbb', tasks)).toBe('doing');
    expect(dropColumnKey('ccc', tasks)).toBe('done');
  });

  it('หย่อนทับการ์ดในคอลัมน์เดิม → ได้คอลัมน์เดิม (หน้าจอจะตัดทิ้งเองว่าไม่ได้ขยับ)', () => {
    expect(dropColumnKey('aaa', tasks)).toBe('todo');
  });

  it('หย่อนนอกตัวรับที่รู้จัก → null ไม่เดา', () => {
    expect(dropColumnKey('ไม่รู้จัก', tasks)).toBeNull();
    expect(dropColumnKey('', tasks)).toBeNull();
  });

  it('คอลัมน์ที่ชื่อขึ้นต้นเหมือน id การ์ด ต้องไม่ชนกัน', () => {
    // คีย์คอลัมน์มาจาก `col:` เสมอ · id การ์ดเป็น uuid จึงไม่มีทางขึ้นต้นด้วย col:
    expect(dropColumnKey('col:aaa', tasks)).toBe('aaa');
  });
});

describe('columnTone', () => {
  it('คอลัมน์แรกกับสุดท้ายมีโทนของตัวเอง', () => {
    expect(columnTone(0, 4)).toBe('st-todo');
    expect(columnTone(3, 4)).toBe('st-done');
    expect(columnTone(2, 4)).toBe('st-review');
    expect(columnTone(1, 4)).toBe('st-doing');
  });
});

describe('positionBetween — ลำดับการ์ดในคอลัมน์', () => {
  it('คอลัมน์ว่างเปล่า ได้ค่าตั้งต้น', () => {
    expect(positionBetween(null, null)).toBe(1024);
  });

  it('หย่อนบนสุด ได้ค่าน้อยกว่าใบแรก', () => {
    expect(positionBetween(null, 500)).toBeLessThan(500);
  });

  it('หย่อนล่างสุด ได้ค่ามากกว่าใบสุดท้าย', () => {
    expect(positionBetween(500, null)).toBeGreaterThan(500);
  });

  it('⭐ หย่อนกลาง ได้ค่ากลางระหว่างเพื่อนบ้าน — เขียนแค่แถวเดียว', () => {
    expect(positionBetween(10, 20)).toBe(15);
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  it('แทรกซ้ำที่เดิมหลายชั้นยังได้ค่าที่ต่างกันเสมอ', () => {
    const lo = 1;
    let hi = 2;
    for (let i = 0; i < 40; i++) {
      const mid = positionBetween(lo, hi);
      expect(mid, `ชั้นที่ ${i + 1} ต้องยังอยู่ระหว่างเพื่อนบ้าน`).toBeGreaterThan(lo);
      expect(mid).toBeLessThan(hi);
      hi = mid;
    }
  });
});

describe('dropIndex — หย่อนแล้วไปแทรกช่องไหน', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('หย่อนที่พื้นที่ว่างของคอลัมน์ = ต่อท้าย', () => {
    expect(dropIndex(list, 'col:doing', 0, 0)).toBe(3);
  });

  it('หย่อนเหนือกึ่งกลางของการ์ดที่ทับ = แทรกไว้ข้างบนใบนั้น', () => {
    expect(dropIndex(list, 'b', 100, 150)).toBe(1);
  });

  it('หย่อนใต้กึ่งกลางของการ์ดที่ทับ = แทรกไว้ข้างล่างใบนั้น', () => {
    expect(dropIndex(list, 'b', 200, 150)).toBe(2);
  });

  it('ไม่รู้จักตัวรับ = ต่อท้าย ไม่เดา', () => {
    expect(dropIndex(list, 'ไม่มีใบนี้', 0, 0)).toBe(3);
  });
});
