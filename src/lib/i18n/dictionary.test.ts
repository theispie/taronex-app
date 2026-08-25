/**
 * พจนานุกรมต้องไม่มีคำขาด และต้องไม่เผลอแก้ต้นฉบับไทยที่สเปคห้ามแปลใหม่
 */

import { describe, expect, it } from 'vitest';
import { type DictKey, en, th, translate } from './dictionary';
import { LOCALES } from './types';

describe('พจนานุกรม', () => {
  it('อังกฤษมีครบทุกกุญแจที่ไทยมี', () => {
    const missing = (Object.keys(th) as DictKey[]).filter((k) => !en[k]);
    expect(missing, 'เพิ่มคำไทยแล้วต้องเพิ่มอังกฤษด้วย').toEqual([]);
  });

  it('ไม่มีกุญแจส่วนเกินฝั่งอังกฤษ', () => {
    const extra = Object.keys(en).filter((k) => !(k in th));
    expect(extra).toEqual([]);
  });

  it('ไม่มีคำแปลที่ปล่อยว่าง', () => {
    for (const l of LOCALES) {
      const dict = l === 'th' ? th : en;
      const blank = Object.entries(dict)
        .filter(([, v]) => !String(v).trim())
        .map(([k]) => k);
      expect(blank, `${l} มีคำว่าง`).toEqual([]);
    }
  });

  it('ตัวแปรใน {} ต้องมีเหมือนกันทั้งสองภาษา', () => {
    const vars = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(',');
    for (const k of Object.keys(th) as DictKey[]) {
      expect(vars(en[k]), `${k} มีตัวแปรไม่ตรงกัน`).toBe(vars(th[k]));
    }
  });
});

describe('translate()', () => {
  it('แทนที่ตัวแปรได้', () => {
    expect(translate('th', 'ws.daysLeft', { n: 5 })).toContain('5');
    expect(translate('en', 'ws.daysLeft', { n: 5 })).toContain('5');
  });

  it('ภาษาที่ไม่มีคำแปลตกกลับไปที่ไทย ไม่ใช่คืนกุญแจดิบ', () => {
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('th', 'nav.home')).toBe('หน้าแรก');
  });
});

describe('⭐ ถ้อยคำที่สเปคเขียนว่าห้ามแปลใหม่', () => {
  it('ไทยยังเป็นคำเดิม', () => {
    // สเปคหน้า 42 — บรรทัดล่างสุดตอบคำถามความปลอดภัยที่คนคิดในใจโดยไม่ต้องถาม
    expect(th['ws.foot']).toContain('ไม่มีรายชื่อบริษัทให้ค้นหา');
    // สเปคหน้า 46 — "ไม่มีความเคลื่อนไหว" ไม่ใช่ "ไม่มีผลงาน"
    expect(JSON.stringify(th)).not.toContain('ไม่มีผลงาน');
  });
});
