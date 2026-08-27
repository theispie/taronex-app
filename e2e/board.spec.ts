import { expect, test } from '@playwright/test';
import { columnDropPoint, dragCardTo } from './drag';

/**
 * เกณฑ์ผ่านของ M6 ตาม BUILD-PLAN
 *   ลากไปข้างหน้า → ย้ายทันที ไม่มีกล่องยืนยัน
 *   ลากเข้าคอลัมน์สุดท้ายในฐานะคนที่ไม่ใช่ PM → ถูกปฏิเสธ และการ์ดเด้งกลับ
 *   ปุ่มย้อนกลับของเบราว์เซอร์ปิดลิ้นชัก
 *
 * เทสต์นี้ลากของจริงด้วยเมาส์ ไม่ใช่เรียกฟังก์ชันตรงๆ
 * เพราะสิ่งที่ต้องพิสูจน์คือ "ปล่อยเมาส์แล้วเกิดอะไรขึ้นบนจอ"
 */

const PW = 'รหัสผ่านยาวพอ123';

async function dragCardToColumn(
  page: import('@playwright/test').Page,
  code: string,
  columnName: string,
) {
  // จังหวะการลากอยู่ใน ./drag — runner ของ CI เร็วกว่าเครื่องพัฒนาจน dnd-kit ตามไม่ทัน
  const point = await columnDropPoint(page, columnName, 80);
  await dragCardTo(page, code, point.x, point.y);
}

test('ลากการ์ดบนบอร์ด · ย้ายทันที · ปฏิเสธแล้วเด้งกลับ · ย้อนกลับปิดลิ้นชัก', async ({ page }) => {
  const email = `board-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบบอร์ด');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';

  const api = `/app/api/v1/t/${slug}`;
  const client = await page.request.post(`${api}/clients`, {
    data: { name: 'ลูกค้า', code: 'B' },
  });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  // ไม่ตั้ง pmUserId — คนที่ล็อกอินอยู่จึงไม่ใช่ PM ของโปรเจกต์นี้
  const project = await page.request.post(`${api}/projects`, {
    data: { key: 'BRD', name: 'บอร์ดทดสอบ', clientId, startsOn: '2026-01-01', dueOn: '2026-06-30' },
  });
  expect(project.ok(), await project.text()).toBe(true);

  const task = await page.request.post(`${api}/projects/BRD/tasks`, {
    data: { title: 'การ์ดสำหรับลาก' },
  });
  expect(task.ok(), await task.text()).toBe(true);
  const code = (await task.json()).data.code;

  await page.goto(`/app/${slug}/projects/BRD/board`);
  await expect(page.locator('.tk', { hasText: code })).toBeVisible({ timeout: 15000 });

  // ── ลากไปข้างหน้า → ย้ายทันที ไม่มีกล่องยืนยัน ──
  await dragCardToColumn(page, code, 'กำลังทำ');
  await expect(
    page.locator('.bcol', { hasText: 'กำลังทำ' }).locator('.tk', { hasText: code }),
    'ปล่อยเมาส์แล้วต้องย้ายเลย ไม่ต้องกดยืนยัน',
  ).toBeVisible({ timeout: 10000 });

  // ── ลากเข้าคอลัมน์สุดท้ายทั้งที่ไม่ใช่ PM → ต้องถูกปฏิเสธและเด้งกลับ ──
  await dragCardToColumn(page, code, 'เสร็จ');

  await expect(page.getByText('ปิดงานได้เฉพาะ PM ของโปรเจกต์')).toBeVisible({ timeout: 10000 });
  await expect(
    page.locator('.bcol', { hasText: 'กำลังทำ' }).locator('.tk', { hasText: code }),
    'ถูกปฏิเสธแล้วการ์ดต้องเด้งกลับที่เดิม ไม่ใช่ค้างผิดคอลัมน์',
  ).toBeVisible();

  // ── ลิ้นชัก: เปิดแล้ว URL ต้องเปลี่ยน · ปุ่มย้อนกลับต้องปิด ──
  await page.locator('.tk', { hasText: code }).first().click();
  await expect(page).toHaveURL(new RegExp(`card=${code}`), { timeout: 10000 });
  await expect(page.getByRole('link', { name: 'เปิดหน้าเต็ม' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('link', { name: 'เปิดหน้าเต็ม' })).toBeHidden({ timeout: 10000 });
});
