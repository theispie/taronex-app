import { expect, test } from '@playwright/test';

/**
 * ⭐ ลิ้นชักการ์ดแบบ Trello — แก้ได้ครบในนั้น บันทึกเอง ปิดด้วยการกดนอกกรอบ
 *
 * สิ่งที่ต้องพิสูจน์คือ "ปิดลิ้นชักแล้วของที่แก้ยังอยู่" ไม่ใช่แค่ช่องกรอกเปลี่ยนค่าบนจอ
 * จึงต้องรีโหลดหน้าแล้วอ่านซ้ำ และยืนยันที่เซิร์ฟเวอร์อีกชั้น
 */

const PW = 'รหัสผ่านยาวพอ123';
test.setTimeout(120000);

test('ลิ้นชักการ์ด · แก้ได้ครบ · บันทึกอัตโนมัติ · กดนอกกรอบแล้วปิด', async ({ page }) => {
  const email = `drawer-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัทลิ้นชัก');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'D' } });
  const clientId = (await c.json()).data.id;
  const pr = await page.request.post(`${api}/projects`, {
    data: {
      key: 'DW',
      name: 'ทดสอบลิ้นชัก',
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
      board: [
        { key: 'c1', name: 'รอเริ่ม' },
        { key: 'c2', name: 'กำลังทำ' },
      ],
    },
  });
  const pid = (await pr.json()).data.id;
  const t = await page.request.post(`${api}/projects/${pid}/tasks`, {
    data: { title: 'การ์ดสำหรับแก้', type: 'task' },
  });
  expect(t.ok(), await t.text()).toBe(true);
  const code = (await t.json()).data.code;

  await page.goto(`/app/${slug}/projects/DW/board`);
  await expect(page.locator('.tk').first()).toBeVisible({ timeout: 20000 });
  await page.locator('.tk', { hasText: code }).first().click();

  const drawer = page.locator('.ovl');
  await expect(drawer).toBeVisible({ timeout: 10000 });

  // ── ข้อมูลต้องครบในลิ้นชัก ไม่ต้องเปิดหน้าเต็ม ──
  const title = drawer.locator('input').first();
  await expect(title).toHaveValue('การ์ดสำหรับแก้');
  await expect(drawer.getByText('รายละเอียด')).toBeVisible();
  await expect(drawer.getByText('ผู้รับผิดชอบ')).toBeVisible();
  await expect(drawer.getByText('ความสำคัญ')).toBeVisible();
  await expect(drawer.getByText('กำหนดส่ง')).toBeVisible();
  await expect(drawer.getByText('คอมเมนต์')).toBeVisible();
  await expect(drawer.getByText('ประวัติ')).toBeVisible();

  // ── แก้แล้วบันทึกเอง ไม่มีปุ่มบันทึก ──
  await expect(drawer.getByRole('button', { name: 'บันทึก' })).toHaveCount(0);
  await title.fill('ชื่อใหม่หลังแก้');
  await drawer.locator('textarea').first().fill('รายละเอียดที่พิมพ์ในลิ้นชัก');
  await expect(drawer.getByText('บันทึกแล้ว')).toBeVisible({ timeout: 15000 });

  // ── กดนอกกรอบแล้วต้องปิด ──
  await drawer.click({ position: { x: 5, y: 5 } });
  await expect(drawer, 'กดฉากหลังแล้วลิ้นชักต้องปิด').toBeHidden({ timeout: 10000 });
  expect(page.url()).not.toContain('card=');

  // ── รีโหลดแล้วของที่แก้ต้องยังอยู่ ──
  await page.reload();
  await expect(page.locator('.tk', { hasText: 'ชื่อใหม่หลังแก้' })).toBeVisible({ timeout: 20000 });

  const saved = await page.request.get(`${api}/projects/${pid}/tasks`);
  const rows = (await saved.json()).data as { title: string }[];
  expect(rows.map((r) => r.title)).toContain('ชื่อใหม่หลังแก้');
});
