import { describe, expect, it } from 'vitest';
import { columnTone, dropColumnKey } from './types';

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
