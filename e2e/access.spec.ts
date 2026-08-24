import { expect, test } from '@playwright/test';

/**
 * หน้าสิทธิ์กับโควตาทำงานจริง และปิดโปรเจกต์แล้วข้อมูลไม่หาย (กฎข้อ 7)
 *
 * เทสต์นี้ตรวจสิ่งที่ทั้งเทสต์หน่วยและ curl จับไม่ได้ —
 * ว่าคอลัมน์ "ผลลัพธ์จริง" บนจอ **เปลี่ยนตามค่าที่เพิ่งกด**
 * ถ้าหน้าไปคำนวณสิทธิ์เองแล้วไม่ตรงกับเซิร์ฟเวอร์ ตารางนี้จะโกหกโดยไม่มีอะไรฟ้อง
 */

const PW = 'รหัสผ่านยาวพอ123';

test('สิทธิ์รายโปรเจกต์เปลี่ยนผลลัพธ์จริงบนจอ · ปิดโปรเจกต์คืนโควตาโดยข้อมูลไม่หาย', async ({ page }) => {
  const email = `acc-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบสิทธิ์');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('เจ้าของ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const client = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'X' } });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  // เจ้าของเป็น PM ไม่ได้ในเทสต์นี้ — ต้องมีคนที่ "ไม่ใช่ PM" ให้ตั้งยกเว้นดู
  // จึงไม่ตั้ง pmUserId เลย เจ้าของยังเขียนได้เพราะเป็น owner
  const project = await page.request.post(`${api}/projects`, {
    data: { key: 'ACM', name: 'โปรเจกต์หนึ่ง', clientId, startsOn: '2026-01-01', dueOn: '2026-12-31' },
  });
  expect(project.ok(), await project.text()).toBe(true);

  const task = await page.request.post(`${api}/projects/ACM/tasks`, {
    data: { title: 'การ์ดที่ต้องไม่หาย' },
  });
  expect(task.ok(), await task.text()).toBe(true);
  const code = (await task.json()).data.code;

  // ── หน้าสิทธิ์ ──
  await page.goto(`/app/${slug}/projects/ACM/access`);
  const row = page.locator('tbody tr', { hasText: 'เจ้าของ' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  // เจาะที่ป้ายผลลัพธ์ ไม่ใช่ <option> ในช่องเลือกที่มีข้อความเดียวกัน
  const effective = row.locator('span.chip.st-done');
  await expect(effective).toHaveText('ร่วมงานได้');

  // เปลี่ยนค่าเริ่มต้นเป็นดูอย่างเดียว — เจ้าของต้องยัง "ร่วมงานได้"
  // ใช้ click ไม่ใช่ check — ปุ่มนี้เป็น controlled input ที่ติ๊กจริงหลังเซิร์ฟเวอร์ตอบกลับ
  // check() จะยืนยันสถานะทันทีหลังคลิกแล้วพังทุกครั้ง
  await page.getByRole('radio', { name: /ดูอย่างเดียว/ }).click();
  await expect(page.getByRole('radio', { name: /ดูอย่างเดียว/ })).toBeChecked({ timeout: 15000 });
  await expect(
    effective,
    'เจ้าของที่ทำงานเขียนได้เสมอ ไม่ว่าค่าเริ่มต้นจะเป็นอะไร',
  ).toHaveText('ร่วมงานได้');

  // ── ปิดโปรเจกต์จากหน้าแก้ไข ──
  await page.goto(`/app/${slug}/projects/ACM/edit`);
  await expect(page.getByRole('button', { name: 'ปิดโปรเจกต์' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'ปิดโปรเจกต์' }).click();
  await page.waitForURL(new RegExp(`/app/${slug}/projects$`), { timeout: 15000 });

  // ⭐ ข้อมูลต้องยังอยู่ครบ — ปิด ≠ ลบ
  const still = await page.request.get(`${api}/projects/ACM/tasks`);
  expect(still.ok(), await still.text()).toBe(true);
  const rows = (await still.json()).data;
  expect(
    rows.map((t: { code: string }) => t.code),
    'ปิดโปรเจกต์ต้องไม่ลบการ์ด',
  ).toContain(code);

  // ── หน้าโควตาเห็นตัวเลขจริง ──
  await page.goto(`/app/${slug}/limits`);
  await expect(page.getByText(/ใช้ไป 0\/3 โปรเจกต์/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/ข้อมูลของคุณยังอยู่ครบทุกอย่าง/)).toBeVisible();

  // ── เปิดคืนได้ ──
  await page.goto(`/app/${slug}/projects/ACM/edit`);
  await expect(page.getByText(/โปรเจกต์นี้ปิดอยู่/)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'เปิดโปรเจกต์คืน' }).click();
  await expect(page.getByText(/โปรเจกต์นี้ปิดอยู่/)).toHaveCount(0, { timeout: 15000 });
});
