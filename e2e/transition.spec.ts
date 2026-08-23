import { expect, test } from '@playwright/test';

/**
 * เทสต์ผ่านเบราว์เซอร์จริง — ตรวจสิ่งที่ curl ตรวจไม่ได้
 *
 * หน้าจอเป็น client component ข้อมูลโหลดหลัง mount
 * การยิง curl จึงเห็นแต่โครงว่างกับคำว่า "กำลังโหลด…"
 * ต้องมีเบราว์เซอร์จริงถึงจะรู้ว่าคนใช้เห็นอะไรและกดแล้วเกิดอะไรขึ้น
 *
 * เทสต์นี้เดินเส้นทางเดียวกับที่คนใช้จริงเดิน ตั้งแต่สมัครจนตีกลับการ์ด
 */

const PW = 'รหัสผ่านยาวพอ123';
const stamp = Date.now();
const email = `e2e-${stamp}@test.co`;

test('สมัคร → สร้างโปรเจกต์ → สร้างการ์ด → ย้าย → ตีกลับ → ปิดงาน', async ({ page }) => {
  // ── สมัครผ่านหน้าจอจริง ──
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบ e2e');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();

  // สมัครเสร็จต้องเด้งเข้าที่ทำงานใหม่
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 15000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  expect(slug).toHaveLength(12);

  // ── เตรียมข้อมูลผ่าน API (ไม่ใช่สิ่งที่เทสต์นี้ตรวจ) ──
  const api = `/app/api/v1/t/${slug}`;
  // ใช้ page.request เพื่อให้ใช้คุกกี้เดียวกับเบราว์เซอร์ · request ธรรมดาเป็นคนละ context
  const client = await page.request.post(`${api}/clients`, {
    data: { name: 'ลูกค้าทดสอบ', code: 'TST' },
  });
  expect(client.ok(), await client.text()).toBe(true);
  const clientId = (await client.json()).data.id;

  const project = await page.request.post(`${api}/projects`, {
    data: {
      key: 'E2E',
      name: 'โปรเจกต์ทดสอบ',
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-06-30',
    },
  });
  // ตรวจขั้นเตรียมข้อมูลด้วย ไม่งั้นพังตรงนี้แล้วไปตกที่ขั้นถัดไปแบบงงๆ
  expect(project.ok(), await project.text()).toBe(true);

  // ── สร้างการ์ดผ่านหน้าจอจริง ──
  await page.goto(`/app/${slug}/projects/E2E/tickets/new`);
  await page.getByPlaceholder('ทำหน้าตะกร้าสินค้า').fill('การ์ดจากเบราว์เซอร์');
  await page.getByRole('button', { name: 'สร้างการ์ด' }).click();
  await page.waitForURL(/\/tickets\/E2E-1/, { timeout: 15000 });

  // ── หน้าการ์ดต้องแสดงปุ่มย้ายคอลัมน์ ──
  await expect(page.getByText('ย้ายการ์ด')).toBeVisible();
  await expect(page.getByRole('button', { name: 'รอเริ่ม' })).toBeDisabled();

  // ── ย้ายไปข้างหน้าสองขั้น ──
  await page.getByRole('button', { name: 'กำลังทำ' }).click();
  await expect(page.getByRole('button', { name: 'กำลังทำ' })).toBeDisabled({ timeout: 10000 });
  await page.getByRole('button', { name: 'รอตรวจ' }).click();
  await expect(page.getByRole('button', { name: 'รอตรวจ' })).toBeDisabled({ timeout: 10000 });

  // ── ตีกลับ: กดถอยหลังแล้วกล่องเหตุผลต้องโผล่ ──
  await page.getByRole('button', { name: '← กำลังทำ' }).click();
  await expect(page.getByText('การ์ดจะกลับไปหาเจ้าของคนก่อน')).toBeVisible();

  // ปุ่มตีกลับต้องกดไม่ได้จนกว่าจะใส่เหตุผล
  const bounce = page.getByRole('button', { name: 'ตีกลับ', exact: true });
  await expect(bounce).toBeDisabled();

  await page.getByPlaceholder(/ส่วนลดซ้อนกัน/).fill('ยังคำนวณผิดตอนใส่คูปองสองใบ');
  await expect(bounce).toBeEnabled();
  await bounce.click();

  // ── เหตุผลต้องโผล่ทั้งในคอมเมนต์และในประวัติ ──
  await expect(page.getByText('ตีกลับ: ยังคำนวณผิดตอนใส่คูปองสองใบ')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('← ตีกลับ').or(page.getByText('ตีกลับ').first())).toBeVisible();

  // ── ปิดงาน: คนสมัครเป็นเจ้าของแต่ไม่ได้เป็น PM ของโปรเจกต์นี้ ──
  // จึงต้องกดปุ่มคอลัมน์สุดท้ายไม่ได้
  const closeBtn = page.getByRole('button', { name: 'เสร็จ' });
  await expect(closeBtn, 'ปิดงานได้เฉพาะ PM ของโปรเจกต์').toBeDisabled();
});
