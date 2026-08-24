import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

/**
 * พอร์ทัลลูกค้าใช้งานได้จริงบนเบราว์เซอร์
 *
 * ⭐ สิ่งที่พิสูจน์และหาไม่ได้ด้วย curl
 *   หน้าเป็น client component ทั้งหมด — curl เห็นแต่โครงว่าง
 *   คุกกี้พอร์ทัลกับคุกกี้ทีมอยู่ใน jar เดียวกันของเบราว์เซอร์ (origin เดียวกัน)
 *   ถ้าแยกไม่ขาดจริง เบราว์เซอร์คือที่ที่มันจะพัง ไม่ใช่ curl ที่ถือ jar คนละใบ
 *
 * โทเคนเข้าพอร์ทัลไม่มีทางออกทาง HTTP โดยตั้งใจ (ดู scripts/dev-portal-link.ts)
 * เทสต์จึงเรียกสคริปต์เดียวกับที่นักพัฒนาใช้
 */

const PW = 'รหัสผ่านยาวพอ123';

function portalLink(slug: string, email: string): string {
  const out = execFileSync('pnpm', ['-s', 'dev:portal-link', slug, email], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  const m = out.match(/token=([A-Za-z0-9_-]+)/);
  if (!m?.[1]) throw new Error(`ไม่ได้โทเคน: ${out}`);
  return m[1];
}

test('ลูกค้าเข้าพอร์ทัล · แจ้งเรื่อง · ทีมกดรับเรื่อง · ลูกค้าเห็นสถานะเปลี่ยน', async ({ page, context }) => {
  const email = `portal-${Date.now()}@test.co`;

  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('เอเจนซี่ทดสอบพอร์ทัล');
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
    data: { key: 'TT', name: 'เว็บไซต์', clientId, startsOn: '2026-01-01', dueOn: '2026-06-30' },
  });
  expect(project.ok(), await project.text()).toBe(true);
  const projectId = (await project.json()).data.id;

  const contact = await page.request.post(`${api}/clients/${clientId}/contacts`, {
    data: { email: 'somying@thongthai.co.th', name: 'คุณสมหญิง' },
  });
  expect(contact.ok(), await contact.text()).toBe(true);

  const deliver = await page.request.post(`${api}/projects/${projectId}/deliver`, { data: {} });
  expect(deliver.ok(), await deliver.text()).toBe(true);

  // ── ฝั่งลูกค้า: เบราว์เซอร์แยกใบ เพื่อพิสูจน์ว่าไม่ได้อาศัยคุกกี้ทีม ──
  const customer = await context.browser()?.newContext();
  if (!customer) throw new Error('เปิด context ใหม่ไม่ได้');
  const cust = await customer.newPage();

  // เข้าโดยไม่มีเซสชัน → ต้องถูกส่งไปหน้าขอลิงก์ ไม่ใช่ค้างหน้าว่าง
  await cust.goto(`/app/portal/${slug}`);
  await cust.waitForURL(/\/portal\/.*\/login/, { timeout: 15000 });
  await expect(cust.getByText('เข้าดูเรื่องที่แจ้งไว้')).toBeVisible();

  // ขอลิงก์ด้วยอีเมลมั่ว — ต้องได้ข้อความเดียวกับอีเมลจริง
  await cust.getByPlaceholder('somying@thongthai.co.th').fill('stranger@nowhere.com');
  await cust.getByRole('button', { name: 'ส่งลิงก์เข้าใช้งาน' }).click();
  await expect(cust.getByText(/ถ้าอีเมลนี้ลงทะเบียนไว้/)).toBeVisible({ timeout: 15000 });

  // เข้าจริงด้วยลิงก์
  const token = portalLink(slug, 'somying@thongthai.co.th');
  await cust.goto(`/app/portal/${slug}/login?token=${token}`);
  await cust.waitForURL(new RegExp(`/portal/${slug}$`), { timeout: 15000 });
  await expect(cust.getByText('คุณสมหญิง · ทองไทย มีเดีย')).toBeVisible({ timeout: 15000 });
  await expect(cust.getByText('เอเจนซี่ทดสอบพอร์ทัล').first()).toBeVisible();

  // ── แจ้งเรื่อง ──
  await cust.getByRole('link', { name: /แจ้งปัญหา/ }).click();
  await cust.waitForURL(/\/new$/, { timeout: 10000 });
  await cust.getByPlaceholder('เช่น ฟอร์มติดต่อกดส่งแล้วไม่มีอีเมลเข้า').fill('ฟอร์มติดต่อส่งอีเมลไม่ออก');
  await cust.getByPlaceholder(/เกิดตอนไหน หน้าไหน/).fill('กดส่งแล้วไม่มีอีเมลเข้ามาเลย');
  await cust.getByRole('button', { name: 'ส่งเรื่อง' }).click();

  await cust.waitForURL(/\/i\/TT-\d+$/, { timeout: 15000 });
  const code = cust.url().split('/i/')[1] ?? '';
  await expect(cust.getByText('ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง').first()).toBeVisible({
    timeout: 15000,
  });

  // ── ฝั่งทีม: เรื่องต้องโผล่ที่ศูนย์ SLA พร้อมป้ายยังไม่มีใครรับ ──
  await page.goto(`/app/${slug}/sla`);
  await expect(page.getByRole('link', { name: code })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('ยังไม่มีใครรับเรื่อง').first()).toBeVisible();

  // ── ⭐ ย้ายการ์ดบนบอร์ด แล้วสิ่งที่ลูกค้าเห็นต้องไม่ขยับ ──
  const triage = await page.request.get(`${api}/sla/triage`);
  const taskId = (await triage.json()).data[0].taskId;
  const proj = await page.request.get(`${api}/projects/${projectId}`);
  const secondColumn = (await proj.json()).data.board[1].key;
  const moved = await page.request.post(`${api}/tasks/${taskId}/transition`, {
    data: { toColumnKey: secondColumn },
  });
  expect(moved.ok(), await moved.text()).toBe(true);

  await cust.reload();
  await expect(
    cust.getByText('ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง').first(),
    'ย้ายคอลัมน์ไม่ใช่การบอกลูกค้า — ต้องมีคนกดเท่านั้น',
  ).toBeVisible({ timeout: 15000 });

  // ── ทีมกดรับเรื่องที่หน้า 39 ──
  await page.goto(`/app/${slug}/sla/${taskId}`);
  await expect(page.getByText('สถานะที่ลูกค้าเห็น')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'รับเรื่องแล้ว', exact: true }).click();
  await expect(page.getByRole('button', { name: 'รับเรื่องแล้ว', exact: true })).toBeDisabled({
    timeout: 15000,
  });

  // ── ลูกค้าเห็นสถานะใหม่ ──
  await cust.reload();
  await expect(cust.getByText('รับเรื่องแล้ว').first()).toBeVisible({ timeout: 15000 });

  // ── กฎข้อ 6 · ไม่มีตัวเลข SLA หรือชื่อคนในทีมบนหน้าลูกค้า ──
  const shown = (await cust.locator('body').innerText()).toLowerCase();
  for (const banned of ['sla', 'ผู้ทดสอบ', 'critical', 'assignee']) {
    expect(shown, `หน้าลูกค้าต้องไม่มีคำว่า "${banned}"`).not.toContain(banned.toLowerCase());
  }

  await customer.close();
});
