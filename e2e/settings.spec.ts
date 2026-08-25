import { expect, test } from '@playwright/test';

/**
 * หน้าบทบาทและหน้าเชิญสมาชิกต่อข้อมูลจริงแล้ว
 *
 * ⭐ กฎข้อ 12 — ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ
 * เทสต์นี้พิสูจน์**สองชั้น**: ปุ่มบนจอปิดตัวเอง และถ้ายิง API ตรงข้ามหน้าเว็บไป
 * ฐานข้อมูลก็ยังปฏิเสธอยู่ดี — ชั้นที่สองคือชั้นที่ป้องกันจริง
 */

const PW = 'รหัสผ่านยาวพอ123';

test('บทบาท: แต่งตั้ง/ถอดเจ้าของ · เชิญสมาชิกบอกโควตาที่นั่ง', async ({ page }) => {
  const email = `set-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบบทบาท');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('เจ้าของคนแรก');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  // ── หน้าบทบาท ── มีเจ้าของคนเดียว ปุ่มถอดต้องกดไม่ได้
  await page.goto(`/app/${slug}/settings/roles`);
  const revoke = page.getByRole('button', { name: 'ถอดสิทธิ์เจ้าของ' });
  await expect(revoke).toBeVisible({ timeout: 15000 });
  await expect(revoke, 'เหลือเจ้าของคนเดียว ปุ่มต้องกดไม่ได้').toBeDisabled();
  await expect(page.getByText(email)).toBeVisible();

  // ⭐ ชั้นที่สอง — ยิง API ตรงๆ ข้ามหน้าเว็บไป ต้องยังถูกปฏิเสธ
  const members = await page.request.get(`${api}/members`);
  expect(members.ok(), await members.text()).toBe(true);
  const meId = (await members.json()).data[0].userId;
  const forced = await page.request.post(`${api}/members/${meId}/revoke-owner`);
  expect(forced.ok(), 'กฎข้อ 12 ต้องบังคับที่ฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่มบนหน้าเว็บ').toBe(false);

  // ── หน้าเชิญสมาชิก ── โควตาที่นั่งต้องมาจากของจริง
  await page.goto(`/app/${slug}/settings/members/invite`);
  await expect(page.getByText(/เหลือที่นั่ง 4 จาก 5/)).toBeVisible({ timeout: 15000 });

  const box = page.getByLabel('อีเมล');
  await box.fill('bee@digitalx.co.th\nkorn@digitalx.co.th');
  await expect(page.getByText(/ตอนนี้ 2 คน/)).toBeVisible();

  // อีเมลผิดรูปแบบต้องบอกก่อนกด ไม่ใช่ให้ไปเจอตอนกดส่ง
  await box.fill('ไม่ใช่อีเมล');
  await expect(page.getByText(/รูปแบบอีเมลไม่ถูกต้อง/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ส่งคำเชิญ' })).toBeDisabled();

  // เกินที่นั่งต้องเตือนก่อนกด
  await box.fill(['a', 'b', 'c', 'd', 'e'].map((x) => `${x}@digitalx.co.th`).join('\n'));
  await expect(page.getByText(/เชิญ 5 คน แต่เหลือที่นั่ง 4/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ส่งคำเชิญ' })).toBeDisabled();

  // ส่งจริง
  await box.fill('bee@digitalx.co.th\nkorn@digitalx.co.th');
  await page.getByRole('button', { name: 'ส่งคำเชิญ' }).click();
  await expect(page.getByText(/ส่งคำเชิญแล้ว 2 คน/)).toBeVisible({ timeout: 15000 });
});
