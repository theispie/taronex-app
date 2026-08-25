import { expect, test } from '@playwright/test';

/**
 * หน้าผังฐานข้อมูลต้องแสดงของจริง ไม่ใช่ของที่พิมพ์ไว้
 *
 * เทสต์นี้ยืนยันสองอย่างที่สำคัญกว่าความสวยงาม
 *   1. ตัวเลข RLS มาจากฐานจริง ไม่ใช่จากโค้ด — ถ้า `db/rls.sql` ยังไม่ได้ลง หน้าต้องฟ้อง
 *   2. ผังฟิลด์มาจาก schema.ts จริง — ค้นชื่อฟิลด์แล้วต้องเจอ
 */

test('ผังฐานข้อมูลแสดงตาราง ฟิลด์ และสถานะ RLS จากฐานจริง', async ({ page }) => {
  await page.goto('/app/internal/db');

  // ── ตัวเลขรวม ──
  await expect(page.getByText('ตาราง', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('ฟิลด์รวม')).toBeVisible();

  // RLS ต้องครบทุกตารางที่มี tenant_id · ถ้าไม่ครบแปลว่า db/rls.sql ไม่ได้ลง
  const rlsBox = page.locator('.istat .c', { hasText: 'RLS + FORCE' });
  await expect(rlsBox).toBeVisible();
  const rls = (await rlsBox.locator('.n').innerText()).trim();
  const [done, total] = rls.split('/').map((x) => Number(x.trim()));
  expect(total, 'ต้องมีตารางที่ต้องเปิด RLS มากกว่า 20 ตาราง').toBeGreaterThan(20);
  expect(done, `RLS ไม่ครบ (${rls}) — db/rls.sql ยังไม่ได้ลงกับฐานนี้`).toBe(total);

  // ── role ที่แอปใช้ต้องข้าม RLS ไม่ได้ ──
  await expect(page.getByText(/superuser=ไม่ · bypassrls=ไม่/)).toBeVisible();

  // ── trigger ที่บังคับกติกาต้องมีอยู่จริงในฐาน ──
  for (const t of ['guard_task_column', 'guard_portal_stage', 'guard_last_owner']) {
    await expect(page.getByText(t, { exact: true })).toBeVisible();
  }

  // ── ผังในโค้ดกับฐานจริงต้องตรงกัน ──
  await expect(
    page.getByText('ผังในโค้ดกับฐานจริงไม่ตรงกัน'),
    'ถ้าขึ้นแปลว่า migration ยังไม่ได้รันครบ',
  ).toHaveCount(0);

  // ── ค้นหาฟิลด์จริง ──
  const search = page.getByPlaceholder(/ค้นชื่อตารางหรือชื่อฟิลด์/);
  await search.fill('portal_stage');
  await expect(page.getByText('tasks', { exact: true }).first()).toBeVisible();
  // หมายเหตุที่พิมพ์มือต้องมาด้วย
  await expect(page.getByText(/ต้องมีคนกดเสมอ/).first()).toBeVisible();

  await search.fill('ไม่มีฟิลด์ชื่อนี้แน่ๆ');
  await expect(page.getByText(/ไม่พบตารางหรือฟิลด์/)).toBeVisible();

  // ── ตารางที่สำคัญที่สุดต้องอยู่ครบ ──
  await search.fill('');
  for (const t of ['tasks', 'task_events', 'sla_clocks', 'portal_tokens']) {
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible();
  }
});
