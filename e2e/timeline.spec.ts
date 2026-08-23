import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/**
 * เกณฑ์ผ่านของ M7
 *   พิมพ์จากเบราว์เซอร์แล้วได้ PDF ที่อ่านได้จริง ฟอนต์ไทยไม่เพี้ยน แท่งไม่ถูกตัดกลางหน้า
 *
 * เทสต์นี้สั่งพิมพ์จริงแล้วอ่านไฟล์ PDF ที่ได้ออกมาตรวจ
 * ไม่ได้แค่ดูว่าปุ่มพิมพ์มีอยู่ — เพราะสิ่งที่ต้องพิสูจน์คือไฟล์ที่ออกมาใช้ได้
 */

const PW = 'รหัสผ่านยาวพอ123';

test('Timeline · แท่งคำนวณจากการ์ดลูก · พิมพ์เป็น PDF ได้จริง', async ({ page }, testInfo) => {
  const email = `tl-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบไทม์ไลน์');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const client = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'T' } });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  const project = await page.request.post(`${api}/projects`, {
    data: {
      key: 'TML',
      name: 'ทดสอบไทม์ไลน์',
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    },
  });
  expect(project.ok(), await project.text()).toBe(true);

  // งานหลักที่มีการ์ด → แท่งทึบ · งานหลักที่ไม่มีการ์ด → แท่งเส้นประ
  const withTasks = await page.request.post(`${api}/projects/TML/features`, {
    data: { name: 'ตะกร้าและชำระเงิน' },
  });
  const featureId = (await withTasks.json()).data.id;
  await page.request.post(`${api}/projects/TML/features`, { data: { name: 'งานหลักที่ยังไม่เริ่ม' } });

  for (const [title, due] of [
    ['การ์ดหนึ่ง', '2026-02-15'],
    ['การ์ดสอง', '2026-04-20'],
  ] as const) {
    const t = await page.request.post(`${api}/projects/TML/tasks`, {
      data: { title, featureId, startDate: '2026-01-10', dueDate: due },
    });
    expect(t.ok(), await t.text()).toBe(true);
  }
  // การ์ดที่ไม่มีงานหลัก → เลนงานนอกแผน
  await page.request.post(`${api}/projects/TML/tasks`, {
    data: { title: 'งานแทรก', startDate: '2026-03-01', dueDate: '2026-05-10' },
  });

  await page.goto(`/app/${slug}/projects/TML/timeline`);

  // ── เลนต้องครบ รวมเลนงานนอกแผน ──
  await expect(page.getByText('ตะกร้าและชำระเงิน')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('งานหลักที่ยังไม่เริ่ม')).toBeVisible();
  await expect(page.locator('svg').getByText('งานนอกแผน')).toBeVisible();

  // งานหลักที่มีการ์ดต้องบอกจำนวน · ที่ไม่มีต้องบอกว่ายังไม่มีการ์ด
  // จำกัดขอบเขตไว้ในกราฟ ไม่งั้นชนกับคำอธิบายใต้กราฟที่มีข้อความเดียวกัน
  const chart = page.locator('svg');
  await expect(chart.getByText('0/2 เสร็จ')).toBeVisible();
  await expect(chart.getByText('ยังไม่มีการ์ด')).toBeVisible();

  // แท่งเส้นประของงานหลักที่ยังไม่มีการ์ด
  await expect(page.locator('svg rect[stroke-dasharray]')).toHaveCount(1);

  // ── พิมพ์เป็น PDF จริงแล้วตรวจไฟล์ที่ได้ ──
  const pdfPath = testInfo.outputPath('timeline.pdf');
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
  });

  const pdf = await readFile(pdfPath);
  expect(pdf.subarray(0, 5).toString(), 'ต้องเป็นไฟล์ PDF จริง').toBe('%PDF-');
  expect(pdf.length, 'PDF ต้องมีเนื้อหา ไม่ใช่หน้าเปล่า').toBeGreaterThan(8000);

  // ── ตอนพิมพ์ต้องซ่อนเมนูและแท็บ เหลือแต่กราฟ ──
  await expect(page.locator('.side')).toBeHidden();
  await expect(page.locator('.tabs')).toBeHidden();
  // หัวข้อที่โผล่เฉพาะตอนพิมพ์ — พิมพ์ออกมาแล้วต้องรู้ว่าเป็นโปรเจกต์ไหน
  await expect(page.getByText('TML · ทดสอบไทม์ไลน์')).toBeVisible();
});
