import { describe, expect, it } from 'vitest';
import { runAudit } from './audit';
import { ALL_ENDPOINTS, CROSS_TENANT_ALLOWLIST, endpointKey } from './registry';
import { SCREENS, usedByScreens } from './screens';

/**
 * เทสต์นี้ทำให้ตัวตรวจ 11 ข้อกลายเป็นเงื่อนไขของ CI
 *
 * ที่ผ่านมาผลตรวจดูได้ที่หน้า /internal/api อย่างเดียว ซึ่งต้องมีคนเปิดดู
 * พอมาอยู่ตรงนี้ ใครแก้ทะเบียนผิดกฎแล้ว push จะรู้ทันทีโดยไม่ต้องมีใครทัก
 */
describe('ทะเบียน API ต้องไม่ผิดกฎที่ห้ามละเมิด', () => {
  const results = runAudit();

  it('ไม่มีข้อไหนตก', () => {
    const failed = results.filter((r) => r.level === 'fail');
    expect(
      failed.map((r) => `${r.title}: ${r.offenders.join(' · ')}`),
      'มีกฎที่ทะเบียนละเมิด',
    ).toEqual([]);
  });

  // แต่ละข้อแยกเป็นเทสต์ของตัวเอง เวลาแดงจะได้รู้ว่าข้อไหน
  for (const r of results) {
    it(`${r.rule > 0 ? `กฎข้อ ${r.rule} — ` : ''}${r.title}`, () => {
      expect(r.offenders, r.detail).toEqual(r.level === 'warn' ? r.offenders : []);
    });
  }
});

describe('กฎข้อ 11 — สี่ endpoint เท่านั้นที่ข้าม tenant ได้', () => {
  it('รายชื่อในโค้ดตรงกับที่ติดธงไว้ ทั้งขาดและเกิน', () => {
    const flagged = ALL_ENDPOINTS.filter((e) => e.crossTenant)
      .map(endpointKey)
      .sort();
    expect(flagged).toEqual([...CROSS_TENANT_ALLOWLIST].sort());
  });

  it('มีสี่รายการพอดี ไม่ใช่สามหรือห้า', () => {
    expect(ALL_ENDPOINTS.filter((e) => e.crossTenant)).toHaveLength(4);
  });
});

describe('กฎข้อ 4 และประตูของสถานะพอร์ทัล', () => {
  it('PATCH /tasks/:id ประกาศว่าปฏิเสธทั้ง column_key และ portal_stage', () => {
    const patch = ALL_ENDPOINTS.find((e) => e.method === 'PATCH' && e.path === '/tasks/:id');
    expect(patch).toBeDefined();
    expect(patch?.summary).toContain('column_key');
    expect(patch?.summary).toContain('portal_stage');
  });

  it('มีประตูเดียวสำหรับย้ายคอลัมน์ และอีกประตูเดียวสำหรับสถานะพอร์ทัล', () => {
    const gates = ALL_ENDPOINTS.filter(
      (e) => e.path === '/tasks/:id/transition' || e.path === '/tasks/:id/portal-stage',
    );
    expect(gates).toHaveLength(2);
    expect(gates.every((g) => g.method === 'POST')).toBe(true);
  });
});

describe('ทะเบียนกับหน้าจอต้องตรงกัน', () => {
  it('ครบทั้ง 52 หน้าจอ', () => {
    expect(SCREENS).toHaveLength(52);
  });

  it('ทุก endpoint ที่หน้าจออ้างถึงมีอยู่จริงในทะเบียน', () => {
    const known = new Set(ALL_ENDPOINTS.map(endpointKey));
    const missing = SCREENS.flatMap((s) =>
      s.uses.filter((u) => !known.has(u)).map((u) => `${s.no} → ${u}`),
    );
    expect(missing).toEqual([]);
  });

  it('ไม่มี endpoint ที่ไม่มีหน้าจอไหนเรียกและไม่ใช่โครงสร้างพื้นฐาน', () => {
    const used = usedByScreens();
    const orphans = ALL_ENDPOINTS.map(endpointKey).filter((k) => !used.has(k));
    expect(orphans).toEqual([]);
  });
});
