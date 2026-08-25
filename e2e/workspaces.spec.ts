import { expect, test } from '@playwright/test';

/**
 * หน้ากลาง "ที่ทำงานของฉัน" (หน้าจอ 42)
 *
 * เดิมหน้านี้ขึ้นกล่องแดง "ยังไม่ได้เข้าสู่ระบบ" คู่กับปุ่มสร้างที่ทำงานที่กดแล้วไม่สำเร็จ
 * ซึ่งอ่านเหมือนระบบพัง ทั้งที่แค่ยังไม่ได้ล็อกอิน — เทสต์นี้กันไม่ให้กลับไปเป็นแบบนั้น
 */

const PW = 'รหัสผ่านยาวพอ123';

test('ยังไม่ล็อกอิน → พาไปหน้าเข้าสู่ระบบ ไม่ใช่โชว์ข้อผิดพลาด', async ({ page }) => {
  await page.goto('/app/workspaces');
  await page.waitForURL(/\/app\/login/, { timeout: 15000 });
  await expect(page.getByText('ยังไม่ได้เข้าสู่ระบบ')).toHaveCount(0);
});

test('ล็อกอินแล้วเห็นชื่อบริษัท บทบาท และตัวเลขประกอบ', async ({ page }) => {
  const email = `ws-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบหน้ากลาง');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('สมชาย ใจดี');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  // สร้างงานที่ "รอคุณ" หนึ่งใบ
  const members = await page.request.get(`${api}/members`);
  const myId = (await members.json()).data[0].userId;
  const client = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'W' } });
  const clientId = (await client.json()).data.id;
  const project = await page.request.post(`${api}/projects`, {
    data: { key: 'WSX', name: 'โปรเจกต์', clientId, startsOn: '2026-01-01', dueOn: '2026-12-31' },
  });
  expect(project.ok(), await project.text()).toBe(true);
  const task = await page.request.post(`${api}/projects/WSX/tasks`, {
    data: { title: 'การ์ดที่ถืออยู่', assigneeId: myId },
  });
  expect(task.ok(), await task.text()).toBe(true);

  await page.goto('/app/workspaces');

  // ทักทายด้วยชื่อจริง ไม่ใช่หัวข้อกลางๆ
  await expect(page.getByRole('heading', { name: 'สวัสดี สมชาย' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(email)).toBeVisible();

  // ⭐ ชื่อบริษัทต้องขึ้น พร้อมบทบาทและตัวเลขประกอบ
  const tile = page.locator('.ws-tile', { hasText: 'บริษัททดสอบหน้ากลาง' });
  await expect(tile).toHaveCount(1);
  await expect(tile.getByText('เจ้าของ')).toBeVisible();
  await expect(tile.getByText(/1 สมาชิก · 1 โปรเจกต์/)).toBeVisible();
  await expect(tile.getByText('รอคุณ 1'), 'ตัวเลขข้ามที่ทำงานได้เฉพาะการนับ').toBeVisible();

  // เมนูบัญชีอยู่มุมบนขวา — ไม่ได้อยู่ล่างหน้าแล้ว
  await page.locator('.acct-btn').click();
  await expect(page.getByRole('menuitem', { name: /ตั้งค่าบัญชี/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'ออกจากระบบ' })).toBeVisible();
  await page.keyboard.press('Escape');

  // ไม่ได้อัปรูป → ใช้อักษรย่อจากชื่อ (ไม่ใช่จากอีเมล เพราะมีชื่อแล้ว)
  await expect(page.locator('.acct-av')).toHaveText('สม');

  // กดแล้วเข้าที่ทำงานได้จริง
  await tile.click();
  await page.waitForURL(new RegExp(`/app/${slug}$`), { timeout: 15000 });
});
