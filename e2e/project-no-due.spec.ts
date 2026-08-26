import { expect, test } from '@playwright/test';

/**
 * กำหนดส่งไม่บังคับ
 *
 * งานประจำและงานดูแลหลังส่งมอบไม่มีวันจบ การบังคับให้ใส่วันแปลว่าคนจะกรอกวันมั่วๆ
 * ลงไป แล้วตัวเลขที่คำนวณจากกำหนดส่งทั้งหมดจะผิดโดยไม่มีใครรู้
 *
 * "วันเริ่ม" ยังบังคับอยู่ — Timeline ต้องมีจุดตั้งต้นเสมอ ไม่งั้นไม่รู้จะกางจากไหน
 */

const PW = 'รหัสผ่านยาวพอ123';

test('สร้างโปรเจกต์โดยไม่ใส่กำหนดส่งได้ · Timeline บอกว่าไม่มีกำหนดส่ง', async ({ page }) => {
  const email = `nodue-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัทไม่มีกำหนดส่ง');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  // ── ฟอร์มโปรเจกต์ใหม่ · ช่องกำหนดส่งต้องไม่บังคับ แต่วันเริ่มยังบังคับ ──
  await page.goto(`/app/${slug}/projects/new`);
  const due = page.locator('.fld', { hasText: 'กำหนดส่ง' }).locator('input[type="date"]').first();
  const starts = page.locator('.fld', { hasText: 'วันเริ่ม' }).locator('input[type="date"]').first();
  await expect(due).toBeVisible({ timeout: 20000 });
  expect(await due.evaluate((el: HTMLInputElement) => el.required), 'กำหนดส่งต้องไม่บังคับ').toBe(false);
  expect(await starts.evaluate((el: HTMLInputElement) => el.required), 'วันเริ่มยังต้องบังคับ').toBe(true);

  // ── สร้างจริงโดยไม่ส่ง dueOn ──
  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'N' } });
  expect(c.ok(), await c.text()).toBe(true);
  const clientId = (await c.json()).data.id;

  const pr = await page.request.post(`${api}/projects`, {
    data: { key: 'ND', name: 'งานดูแลรายเดือน', clientId, startsOn: '2026-03-01' },
  });
  expect(pr.ok(), await pr.text()).toBe(true);

  const got = await page.request.get(`${api}/projects/ND`);
  expect(got.ok(), await got.text()).toBe(true);
  expect((await got.json()).data.dueOn, 'ต้องเป็น null ไม่ใช่สตริงว่าง').toBeNull();

  // ── Timeline ต้องบอกตรงๆ ว่าไม่มีกำหนดส่ง ไม่ใช่โชว์วันเพี้ยน ──
  await page.goto(`/app/${slug}/projects/ND/timeline`);
  await expect(page.getByText(/ไม่มีกำหนดส่ง/).first()).toBeVisible({ timeout: 20000 });
});
