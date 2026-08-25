import { expect, test } from '@playwright/test';

/**
 * รูปโปรไฟล์ — อัปได้ ลบได้ และ**ไฟล์ที่ไม่ใช่รูปต้องถูกปฏิเสธ**
 *
 * ข้อที่สำคัญที่สุดคือข้อสุดท้าย รูปถูกเสิร์ฟจาก origin เดียวกับระบบ
 * ถ้าอัป SVG หรือ HTML ได้ จะรันสคริปต์ในบริบทของโดเมนเรา = ขโมยเซสชันได้
 */

const PW = 'รหัสผ่านยาวพอ123';

/** PNG 1×1 จริง เล็กที่สุดที่เบราว์เซอร์เปิดได้ */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('อัปรูปโปรไฟล์ · ขึ้นทั้งหน้าตั้งค่าและมุมบนขวา · ลบแล้วกลับไปใช้อักษรย่อ', async ({ page }) => {
  const email = `av-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบรูป');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('มานี รักเรียน');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });

  await page.goto('/app/account');

  // ยังไม่มีรูป → อักษรย่อจากชื่อไทย
  await expect(page.locator('.av-big.fallback')).toHaveText('มา', { timeout: 15000 });

  // ── อัปรูปจริง ──
  await page.locator('input[type="file"]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });
  await expect(page.getByText('เปลี่ยนรูปโปรไฟล์แล้ว')).toBeVisible({ timeout: 20000 });

  const img = page.locator('img.av-big');
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src, 'รูปต้องอยู่ใต้ /app/avatars/').toMatch(/^\/app\/avatars\/[a-f0-9-]+\.png$/);

  // ⭐ ไฟล์ต้องเปิดได้จริงและเสิร์ฟเป็นรูป ไม่ใช่ HTML
  const fetched = await page.request.get(src ?? '');
  expect(fetched.status()).toBe(200);
  expect(fetched.headers()['content-type']).toContain('image/png');
  expect(fetched.headers()['x-content-type-options']).toBe('nosniff');

  // รูปเดียวกันขึ้นที่มุมบนขวาด้วย
  await expect(page.locator('img.acct-av')).toHaveAttribute('src', src ?? '');

  // ── ลบรูป ──
  await page.getByRole('button', { name: 'เอารูปออก' }).click();
  await expect(page.getByText(/กลับไปใช้อักษรย่อ/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.av-big.fallback')).toHaveText('มา');
});

test('⭐ อัป SVG หรือ HTML ไม่ได้ — กันช่อง XSS', async ({ page }) => {
  const email = `avx-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบไฟล์แปลก');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });

  // ยิงตรงที่ API ข้ามหน้าเว็บไป — ตัวกรองต้องอยู่ที่เซิร์ฟเวอร์ ไม่ใช่แค่ accept ของ <input>
  for (const [what, body] of [
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['html', '<!doctype html><script>alert(1)</script>'],
  ] as const) {
    const res = await page.request.post('/app/api/v1/account/avatar', {
      headers: { 'content-type': 'image/png' }, // โกหกว่าเป็น PNG
      data: body,
    });
    expect(res.ok(), `${what} ต้องถูกปฏิเสธ`).toBe(false);
    const err = await res.json();
    expect(err.error.message).toMatch(/PNG · JPG · WebP/);
  }

  // ไม่มีรูปติดมาที่บัญชี
  const me = await page.request.get('/app/api/v1/auth/me');
  expect((await me.json()).data.user.avatarUrl).toBeFalsy();
});
