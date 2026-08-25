import { expect, test } from '@playwright/test';

/**
 * สองภาษา ไทย–อังกฤษ
 *
 * ไทยเป็นค่าเริ่มต้นและเป็นต้นฉบับ อังกฤษเป็นทางเลือก
 * สลับแล้วต้องมีผลทั้งเปลือก (server component) และเนื้อหน้า (client component)
 * ถ้าสั่งวาดใหม่ไม่ครบ จะเห็นครึ่งไทยครึ่งอังกฤษ
 */

const PW = 'รหัสผ่านยาวพอ123';

test('สลับภาษาแล้วเปลี่ยนทั้งเมนูข้างและเนื้อหน้า · จำไว้ข้ามหน้า', async ({ page }) => {
  const email = `i18n-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบภาษา');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('สองภาษา');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';

  // ── ค่าเริ่มต้นคือไทย ──
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.locator('.side nav').getByText('งานของฉัน')).toBeVisible({ timeout: 15000 });

  // ── สลับเป็นอังกฤษจากหน้าที่ทำงานของฉัน ──
  await page.goto('/app/workspaces');
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible({ timeout: 15000 });

  await page.locator('.acct-btn').click();
  await page.getByRole('button', { name: 'English' }).click();

  await expect(page.getByRole('heading', { name: /Hello/ })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Your workspaces')).toBeVisible();

  // ⭐ เปลือกที่เป็น server component ต้องเปลี่ยนด้วย ไม่ใช่แค่เนื้อหน้า
  await page.goto(`/app/${slug}`);
  const nav = page.locator('.side nav');
  await expect(nav.getByText('My work')).toBeVisible({ timeout: 15000 });
  await expect(nav.getByRole('link', { name: /Projects/ })).toBeVisible();
  await expect(nav.getByText('งานของฉัน'), 'ต้องไม่เหลือไทยปนในเมนู').toHaveCount(0);

  // ── จำไว้ข้ามการโหลดใหม่ ──
  await page.reload();
  await expect(nav.getByText('My work')).toBeVisible({ timeout: 15000 });

  // ── สลับกลับเป็นไทย ──
  await page.goto('/app/account');
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'ไทย' }).first().click();
  await expect(page.getByRole('heading', { name: 'ตั้งค่าบัญชี' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
});

test('ภาษาติดไปกับบัญชี — เข้าจากเครื่องอื่นก็ยังเป็นภาษาเดิม', async ({ page, browser }) => {
  const email = `i18n2-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัทจำภาษา');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });

  const res = await page.request.put('/app/api/v1/account/locale', { data: { locale: 'en' } });
  expect(res.ok(), await res.text()).toBe(true);

  // เครื่องใหม่ ไม่มีคุกกี้ภาษา — ต้องได้อังกฤษจากค่าที่บันทึกในบัญชี
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto('/app/login');
  await p2.locator('input[type="email"]').fill(email);
  await p2.locator('input[type="password"]').fill(PW);
  await p2.getByRole('button', { name: /เข้าสู่ระบบ/ }).click();
  await p2.waitForURL(/\/app\/(?!login)/, { timeout: 20000 });
  await p2.goto('/app/workspaces');
  await expect(p2.getByRole('heading', { name: /Hello/ })).toBeVisible({ timeout: 15000 });
  await other.close();
});
