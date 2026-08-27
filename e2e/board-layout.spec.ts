import { expect, test } from '@playwright/test';

/**
 * ⭐ คอลัมน์บนบอร์ดต้องยืดหดตามจอ ไม่ใช่กว้างตามเนื้อหา
 *
 * เดิมหน้าบอร์ดห่อคอลัมน์ด้วย `.bar4` ซึ่งเป็นสไตล์ของแถบ progress (inline-flex)
 * คอลัมน์จึงกว้างตามเนื้อหา ความกว้างขึ้นกับฟอนต์ที่เครื่องนั้นมี
 * และ `.bd` ที่ตั้งใจให้เป็นตัวห่อกลับถูกเอาไปใช้เป็นหัวคอลัมน์แทน
 *
 * ผลคือบนเครื่องที่ฟอนต์กว้างกว่า คอลัมน์ท้ายๆ หลุดออกนอกจอ แล้วลากไปหย่อนไม่ได้
 * — เจอครั้งแรกตอน CI รันเทสต์ลากแล้วตกทั้งที่โค้ดถูก
 */

const PW = 'รหัสผ่านยาวพอ123';
test.setTimeout(120000);

async function makeBoard(page: import('@playwright/test').Page, key: string, columns: number) {
  const email = `layout-${key}-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัทผังบอร์ด');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'P' } });
  const clientId = (await c.json()).data.id;
  const board = Array.from({ length: columns }, (_, i) => ({
    key: `c${i + 1}`,
    name: `ขั้นที่ ${i + 1}`,
  }));
  const pr = await page.request.post(`${api}/projects`, {
    data: { key, name: 'ผังบอร์ด', clientId, startsOn: '2026-01-01', dueOn: '2026-12-31', board },
  });
  expect(pr.ok(), await pr.text()).toBe(true);
  const pid = (await pr.json()).data.id;
  for (let i = 1; i <= 3; i++) {
    await page.request.post(`${api}/projects/${pid}/tasks`, {
      data: { title: `งานที่ ${i} ชื่อยาวพอสมควรเพื่อดันความกว้าง`, type: 'task' },
    });
  }
  await page.goto(`/app/${slug}/projects/${key}/board`);
  await expect(page.locator('.tk').first()).toBeVisible({ timeout: 20000 });
}

test('บอร์ดสี่คอลัมน์ · แบ่งความกว้างเท่ากันและอยู่ในจอครบ', async ({ page }) => {
  await makeBoard(page, 'L4', 4);
  const view = page.viewportSize();
  if (!view) throw new Error('ไม่ทราบขนาดจอ');

  const cols = page.locator('.bcol');
  await expect(cols).toHaveCount(4);

  const widths: number[] = [];
  for (let i = 0; i < 4; i++) {
    const b = await cols.nth(i).boundingBox();
    if (!b) throw new Error(`ไม่พบคอลัมน์ที่ ${i + 1}`);
    widths.push(b.width);
  }
  const min = Math.min(...widths);
  const max = Math.max(...widths);
  expect(max - min, 'ทุกคอลัมน์ต้องกว้างเท่ากัน ไม่ใช่กว้างตามเนื้อหา').toBeLessThanOrEqual(2);

  const last = await cols.nth(3).boundingBox();
  if (!last) throw new Error('ไม่พบคอลัมน์สุดท้าย');
  expect(last.x + last.width, 'คอลัมน์สุดท้ายต้องอยู่ในจอ ไม่งั้นลากไปหย่อนไม่ได้').toBeLessThanOrEqual(
    view.width + 1,
  );
});

test('บอร์ดแปดคอลัมน์ · เลื่อนแนวนอนในกรอบบอร์ด ไม่ดันทั้งหน้าให้เลื่อนตาม', async ({ page }) => {
  await makeBoard(page, 'L8', 8);
  await expect(page.locator('.bcol')).toHaveCount(8);

  const scroll = await page
    .locator('.bd')
    .first()
    .evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
  expect(
    scroll.scrollWidth,
    'แปดคอลัมน์ต้องล้นกรอบบอร์ดแล้วเลื่อนแนวนอนได้ ไม่ใช่บีบจนแคบอ่านไม่ออก',
  ).toBeGreaterThan(scroll.clientWidth);

  const bodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(bodyOverflow, 'ทั้งหน้าต้องไม่เลื่อนแนวนอนตามไปด้วย').toBeLessThanOrEqual(1);
});
