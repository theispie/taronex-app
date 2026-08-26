import { expect, test } from '@playwright/test';

/**
 * เมนูข้างต้องไม่มีตัวเลขที่ไม่ได้มาจากข้อมูลจริง
 *
 * เดิมยกโครงเมนูมาจากต้นแบบแล้วป้ายตัวเลขสมมติติดมาด้วย
 * เมนูบอกว่ามีแจ้งเตือน 3 รายการ แต่กดเข้าไปว่างเปล่า
 * **หน้าจอที่บอกตัวเลขผิดแย่กว่าหน้าจอที่ไม่บอกอะไรเลย** เพราะคนใช้จะเลิกเชื่อทั้งระบบ
 *
 * ⚠ เทสต์นี้เคยค้างข้อความเก่า "ระบบแจ้งเตือนยังต่อไม่เสร็จ" ไว้หลังจากต่อ API แล้ว
 * ทำให้ตกทั้งที่ฟีเจอร์ถูก — ถ้าแก้ถ้อยคำบนหน้าจอ ต้องแก้ที่นี่ด้วยเสมอ
 */

const PW = 'รหัสผ่านยาวพอ123';

test('เมนูข้างไม่มีป้ายตัวเลขปลอม และหน้าแจ้งเตือนว่างจริงตามข้อมูล', async ({ page }) => {
  const email = `nav-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบเมนู');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';

  // ⭐ ไม่มีป้ายตัวเลขในเมนูข้างเลยสักอัน
  await expect(page.locator('.side nav .bg')).toHaveCount(0, { timeout: 15000 });

  // ⭐ ไม่มีจุดแดงปลอมบนไอคอนกระดิ่ง
  await expect(page.locator('.top .ico .dn')).toHaveCount(0);

  // เมนูยังอยู่ครบ แค่ไม่มีตัวเลข
  // ชื่อลิงก์มีไอคอนนำหน้า (เช่น "☑ งานที่ได้รับ") จึงเทียบแบบมีบางส่วน ไม่ใช่ตรงเป๊ะ
  for (const label of ['งานที่ได้รับ', 'การแจ้งเตือน', 'คิวคัดแยก']) {
    const link = page.locator('.side nav').getByRole('link', { name: new RegExp(label) });
    await expect(link).toBeVisible();
    await expect(link, 'ชื่อเมนูต้องไม่มีตัวเลขห้อยท้าย').not.toHaveText(/\d/);
  }

  // ── หน้าแจ้งเตือน ── ว่างจริงตามข้อมูล และบอกว่าอะไรจะทำให้มีขึ้น
  await page.goto(`/app/${slug}/notifications`);
  await expect(page.getByText('0 รายการที่ยังไม่ได้อ่าน')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('ยังไม่มีการแจ้งเตือน')).toBeVisible();
  // ว่างแล้วต้องบอกด้วยว่าอะไรจะทำให้มีขึ้น ไม่ใช่ปล่อยจอเปล่า
  await expect(page.getByText(/จะมีเมื่อมีคนส่งงานมาให้คุณ/)).toBeVisible();

  // ยืนยันที่ฝั่งเซิร์ฟเวอร์ว่าว่างจริง ไม่ใช่หน้าจอโหลดพลาด
  const res = await page.request.get(`/app/api/v1/t/${slug}/notifications`);
  expect(res.ok(), await res.text()).toBe(true);
  expect((await res.json()).data).toEqual([]);
});
