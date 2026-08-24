import { expect, test } from '@playwright/test';

/**
 * หน้ากิจกรรมแสดงข้อมูลจริง และไม่มีตัวเลขที่เอามาเรียงลำดับคนได้ (กฎข้อ 9)
 *
 * เทสต์นี้อ่านสิ่งที่**คนใช้เห็นจริงบนจอ** ไม่ใช่สิ่งที่ API คืน
 * เพราะกฎข้อ 9 เป็นกฎเรื่องสิ่งที่ตาเห็น ไม่ใช่เรื่องรูปแบบข้อมูล
 * API จะสะอาดแค่ไหนก็ไม่ช่วย ถ้าหน้าเว็บไปนับเองแล้วพิมพ์ตัวเลขออกมา
 */

const PW = 'รหัสผ่านยาวพอ123';

test('กิจกรรมรายวันเห็นเหตุการณ์จริง · รายสัปดาห์ไม่มีตัวเลขต่อคน', async ({ page }) => {
  const email = `act-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบกิจกรรม');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const client = await page.request.post(`${api}/clients`, {
    data: { name: 'ลูกค้า', code: 'X' },
  });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  const project = await page.request.post(`${api}/projects`, {
    data: { key: 'ACM', name: 'โปรเจกต์หนึ่ง', clientId, startsOn: '2026-01-01', dueOn: '2026-12-31' },
  });
  expect(project.ok(), await project.text()).toBe(true);

  // กล่องบันทึกความคืบหน้าโผล่เฉพาะการ์ดที่ตัวเองถืออยู่ — ตั้งใจให้เป็นแบบนั้น
  const members = await page.request.get(`${api}/members`);
  expect(members.ok(), await members.text()).toBe(true);
  const myId = (await members.json()).data[0].userId;

  const task = await page.request.post(`${api}/projects/ACM/tasks`, {
    data: { title: 'การ์ดสำหรับกิจกรรม', assigneeId: myId },
  });
  expect(task.ok(), await task.text()).toBe(true);
  const { id: taskId, code } = (await task.json()).data;

  // ทำหลายครั้งพอที่จะดันความเข้มขึ้นเพดาน — ถ้ามีตัวเลขหลุด มันจะเป็นเลขสองหลัก
  for (let i = 0; i < 12; i++) {
    const r = await page.request.post(`${api}/tasks/${taskId}/progress`, {
      data: { body: `ความคืบหน้าครั้งที่ ${i}` },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }

  // ── รายวัน ──
  await page.goto(`/app/${slug}/activity`);
  await expect(page.getByText(`สร้าง ${code}`)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(`บันทึกความคืบหน้าใน ${code}`).first()).toBeVisible();
  await expect(page.getByText(/แตะ 1 การ์ด · 1 โปรเจกต์/)).toBeVisible();

  // กล่องบันทึกความคืบหน้าใช้ได้จริงจากหน้านี้
  await page.getByLabel('เลือกการ์ด').selectOption(taskId);
  await page.getByPlaceholder('ทำถึงไหนแล้ว ติดอะไรอยู่').fill('บันทึกจากหน้ากิจกรรม');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByText(`บันทึกความคืบหน้าใน ${code}`).first()).toBeVisible({
    timeout: 15000,
  });

  // ── รายสัปดาห์ · ⭐ ห้ามมีตัวเลขต่อคน ──
  await page.getByRole('button', { name: 'รายสัปดาห์' }).click();
  await expect(page.getByRole('cell', { name: /ผู้ทดสอบ/ })).toBeVisible({ timeout: 15000 });

  const table = page.locator('table.tbl').first();
  const bodyText = await table.locator('tbody').innerText();
  expect(bodyText, 'ทำไป 13 ครั้ง — ถ้าเห็นเลขสองหลักบนตาราง แปลว่าจำนวนดิบหลุดออกมาแล้ว').not.toMatch(
    /\d{2,}/,
  );

  // ── รายเดือน ──
  await page.getByRole('button', { name: 'รายเดือน' }).click();
  await expect(page.getByText(/ความเข้ม 4 ระดับ ไม่มีตัวเลขกำกับ/)).toBeVisible({ timeout: 15000 });
});
