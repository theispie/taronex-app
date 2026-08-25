import { expect, test } from '@playwright/test';

/**
 * หน้าจอ M10 ต่อข้อมูลจริงแล้วจริงไหม
 *
 * เขียนเทสต์นี้เพราะบั๊กสองตัวที่เจ็บที่สุดในโปรเจกต์นี้
 * ทั้งคู่ทำให้ curl ได้ 200 แต่หน้าจอว่างเปล่า — สถานะ HTTP พิสูจน์อะไรไม่ได้เลย
 *
 * สิ่งที่พิสูจน์:
 *   เรื่องที่ยังไม่มีใครกดรับ ขึ้นที่ศูนย์ SLA พร้อมป้าย "ยังไม่มีใครรับเรื่อง"
 *   กดคัดแยกจริงบนหน้าเว็บ แล้วเรื่องหลุดจากคิว
 *   เลือก "งานเพิ่ม" ต้องบังคับกรอกเหตุผลก่อน
 */

const PW = 'รหัสผ่านยาวพอ123';

test('ศูนย์ SLA และคิวคัดแยกแสดงข้อมูลจริง · คัดแยกแล้วหลุดจากคิว', async ({ page }) => {
  const email = `sla-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบ SLA');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';

  const api = `/app/api/v1/t/${slug}`;
  const client = await page.request.post(`${api}/clients`, {
    data: { name: 'ทองไทย มีเดีย', code: 'T' },
  });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  const project = await page.request.post(`${api}/projects`, {
    data: { key: 'WAR', name: 'ระบบสมาชิก', clientId, startsOn: '2026-01-01', dueOn: '2026-06-30' },
  });
  expect(project.ok(), await project.text()).toBe(true);
  const projectId = (await project.json()).data.id;

  // ส่งมอบก่อน — สัญญาประกันกับนโยบาย SLA เกิดตรงนี้
  const deliver = await page.request.post(`${api}/projects/${projectId}/deliver`, { data: {} });
  expect(deliver.ok(), await deliver.text()).toBe(true);
  expect((await deliver.json()).data.portalEnabled).toBe(true);

  // เรื่องประกันสองใบ — นาฬิกาเริ่มเดินเองทันทีที่สร้าง
  const mk = async (title: string) => {
    const r = await page.request.post(`${api}/projects/WAR/tasks`, {
      data: { title, origin: 'warranty', priority: 'high' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).data;
  };
  const bug = await mk('ล็อกอินไม่ได้หลังอัปเดต');
  await mk('อยากได้ปุ่มส่งออก Excel');

  // ── ศูนย์ SLA ── ต้องเห็นการ์ดจริง ไม่ใช่หน้าว่าง
  await page.goto(`/app/${slug}/sla`);
  await expect(page.getByRole('link', { name: bug.code })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('ยังไม่มีใครรับเรื่อง').first()).toBeVisible();
  await expect(page.getByText('ทองไทย มีเดีย').first()).toBeVisible();

  // ── คิวคัดแยก ──
  // มีทั้งลิงก์ในเมนูข้างและปุ่มบนหัวหน้า — เอาปุ่มบนหัวหน้าที่มีตัวเลขกำกับ
  await page
    .getByRole('link', { name: /คิวคัดแยก 2/ })
    .last()
    .click();
  await page.waitForURL(/\/sla\/triage/, { timeout: 10000 });
  await expect(page.getByText('ล็อกอินไม่ได้หลังอัปเดต')).toBeVisible({ timeout: 15000 });

  // "งานเพิ่ม" ต้องขอเหตุผลก่อน ไม่ยิงทันที
  await page
    .locator('.tk, .card', { hasText: 'อยากได้ปุ่มส่งออก Excel' })
    .first()
    .getByRole('button', { name: /งานเพิ่ม/ })
    .click();
  await expect(page.getByText('บอกลูกค้าว่าทำไมไม่อยู่ในประกัน')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'ยืนยัน' });
  await expect(confirm, 'ยังไม่กรอกเหตุผล ปุ่มยืนยันต้องกดไม่ได้').toBeDisabled();

  await page.locator('textarea').fill('ไม่ได้อยู่ในขอบเขตเดิม ต้องเสนอราคาก่อน');
  await confirm.click();

  // เรื่องที่คัดแยกแล้วต้องหลุดจากคิว เหลือใบเดียว
  await expect(page.getByText('อยากได้ปุ่มส่งออก Excel')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('ล็อกอินไม่ได้หลังอัปเดต')).toBeVisible();

  // ── หน้านาฬิกา ── เส้นเวลาต้องมีเหตุการณ์จริง
  await page.goto(`/app/${slug}/sla/${bug.id}`);
  await expect(page.getByText('ลูกค้ากดส่ง — นาฬิกาเริ่มเดิน')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: 'หยุดนาฬิกา' })).toBeVisible();

  // ── หน้าสัญญา ── ค่าที่บันทึกต้องกลับมาแสดง
  await page.goto(`/app/${slug}/clients/${clientId}/contract`);
  const critical = page.locator('tbody tr', { hasText: 'วิกฤต' }).locator('input').first();
  await expect(critical).toBeVisible({ timeout: 15000 });
  await critical.fill('15');
  await page.getByRole('button', { name: 'บันทึกเป็นเวอร์ชันใหม่' }).click();
  await expect(page.getByText(/บันทึกเป็นเวอร์ชัน 2 แล้ว/)).toBeVisible({ timeout: 15000 });
  await expect(critical).toHaveValue('15');
});
