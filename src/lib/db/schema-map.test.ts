/**
 * ผังฐานข้อมูลต้องไม่เน่า
 *
 * ส่วนที่เป็นกลไก (ชื่อ · ชนิด · กุญแจนอก) อ่านจาก Drizzle จึงตรงเสมออยู่แล้ว
 * ส่วนที่พิมพ์มือคือ "ทำไม" — เทสต์ชุดนี้กันไม่ให้มันชี้ไปที่ของที่ไม่มีแล้ว
 */

import { describe, expect, it } from 'vitest';
import { COLUMN_NOTES, GROUP_ORDER, readSchema, TABLE_NOTES } from './schema-map';

const tables = readSchema();
const byName = new Map(tables.map((t) => [t.name, t]));

describe('อ่านผังจากของจริง', () => {
  it('เจอครบ 24 ตาราง', () => {
    expect(tables).toHaveLength(24);
  });

  it('ทุกตารางมีคอลัมน์ และทุกคอลัมน์มีชนิด', () => {
    for (const t of tables) {
      expect(t.columns.length, `${t.name} ไม่มีคอลัมน์`).toBeGreaterThan(0);
      for (const c of t.columns) {
        expect(c.type, `${t.name}.${c.name} ไม่มีชนิด`).toBeTruthy();
      }
    }
  });

  it('ทุกตารางถูกจัดกลุ่ม ไม่มีตัวไหนตกไปอยู่ "อื่นๆ"', () => {
    const orphans = tables.filter((t) => !GROUP_ORDER.includes(t.group)).map((t) => t.name);
    expect(orphans, 'ตารางใหม่ต้องเพิ่มเข้ากลุ่มใน schema-map.ts ด้วย').toEqual([]);
  });

  it('กุญแจนอกชี้ไปที่ตารางที่มีอยู่จริง', () => {
    for (const t of tables) {
      for (const c of t.columns) {
        if (!c.references) continue;
        expect(
          byName.has(c.references.table),
          `${t.name}.${c.name} ชี้ไป ${c.references.table}`,
        ).toBe(true);
      }
    }
  });
});

describe('⭐ บันทึกที่พิมพ์มือต้องชี้ไปที่ของจริง', () => {
  it('ทุกกุญแจใน TABLE_NOTES เป็นชื่อตารางที่มีอยู่', () => {
    const ghosts = Object.keys(TABLE_NOTES).filter((k) => !byName.has(k));
    expect(ghosts, 'บันทึกชี้ไปที่ตารางที่ไม่มีแล้ว — เปลี่ยนชื่อตารางแล้วลืมแก้บันทึก').toEqual([]);
  });

  it('ทุกกุญแจใน COLUMN_NOTES เป็น ตาราง.คอลัมน์ ที่มีอยู่', () => {
    const ghosts = Object.keys(COLUMN_NOTES).filter((k) => {
      const [table, column] = k.split('.');
      const t = table ? byName.get(table) : undefined;
      return !t || !t.columns.some((c) => c.name === column);
    });
    expect(ghosts, 'บันทึกชี้ไปที่คอลัมน์ที่ไม่มีแล้ว').toEqual([]);
  });
});

describe('ข้อเท็จจริงที่ผังต้องสะท้อนถูก', () => {
  /**
   * สามตารางนี้ไม่มี tenant_id จึงไม่มี RLS — 24 ตาราง ลบ 3 = 21 ที่เปิด RLS
   * `sessions` ผูกกับ*คน* ไม่ใช่กับที่ทำงาน เพราะคนหนึ่งคนอยู่ได้หลายที่ทำงาน
   * ถ้าผูกเซสชันกับที่ทำงาน คนที่อยู่หลายที่จะต้องล็อกอินใหม่ทุกครั้งที่สลับ
   */
  const NO_RLS = ['tenants', 'users', 'sessions'];

  it('สามตารางที่ไม่มี tenant_id คือ tenants · users · sessions', () => {
    const without = tables.filter((t) => !t.hasTenantId).map((t) => t.name);
    expect([...without].sort()).toEqual([...NO_RLS].sort());
  });

  it('ตารางที่เหลือมี tenant_id ครบ (RLS ยึดคอลัมน์นี้)', () => {
    const missing = tables.filter((t) => !t.hasTenantId && !NO_RLS.includes(t.name));
    expect(missing.map((t) => t.name)).toEqual([]);
    expect(tables.length - NO_RLS.length, 'ต้องตรงกับจำนวน policy ในฐานจริง').toBe(21);
  });

  it('⭐ tasks ไม่มีคอลัมน์ task_status — ตัดทิ้งโดยตั้งใจ', () => {
    const names = byName.get('tasks')?.columns.map((c) => c.name) ?? [];
    expect(names).not.toContain('status');
    expect(names).not.toContain('task_status');
    expect(names, 'สถานะคือ "อยู่คอลัมน์ไหน" ซึ่งคือ column_key ตัวเดียว').toContain('column_key');
  });

  it('task_events.task_id ว่างได้ และเป็น ON DELETE SET NULL', () => {
    const col = byName.get('task_events')?.columns.find((c) => c.name === 'task_id');
    expect(col?.notNull).toBe(false);
    expect(col?.references?.onDelete).toBe('set null');
  });

  it('sla_clock_events ไม่มีคอลัมน์ยอดสะสม', () => {
    const names = byName.get('sla_clock_events')?.columns.map((c) => c.name) ?? [];
    for (const banned of ['total', 'elapsed', 'used_minutes', 'accumulated']) {
      expect(names.some((n) => n.includes(banned))).toBe(false);
    }
  });
});
