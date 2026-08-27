import { expect, test } from '@playwright/test';
import { dragCardTo } from './drag';

/**
 * ⭐ บั๊กที่ผู้ใช้แจ้ง 26 ส.ค. 2569 — "ลากข้ามคอลัมน์ไม่ได้"
 *
 * `board.spec.ts` หย่อนที่พื้นที่ว่างของคอลัมน์เสมอ ซึ่งเป็นเคสเดียวที่ยังทำงาน
 * ของจริงคนหย่อน "ทับการ์ดใบอื่น" เพราะคอลัมน์ที่มีงานอยู่ไม่เหลือที่ว่างให้โดน
 * dnd-kit คืน `over` เป็น id ของการ์ดใบนั้น ไม่ใช่ `col:xxx` แล้วโค้ดเดิมเงียบไปเฉยๆ
 *
 * เทสต์นี้จึงพิสูจน์ทั้งสองทางที่คนหย่อนจริง ไม่ใช่ทางที่เขียนเทสต์ง่าย
 */

const PW = 'รหัสผ่านยาวพอ123';

// สมัคร + สร้างข้อมูล + ลากสองรอบ ใช้เวลาเกิน 30 วิ ที่ Playwright ตั้งไว้เป็นค่าเริ่มต้น
test.setTimeout(120000);

test('ลากการ์ดหย่อนทับการ์ดใบอื่นข้ามคอลัมน์ได้ · ไม่ใช่เฉพาะพื้นที่ว่าง', async ({ page }) => {
  const email = `drop-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบการหย่อน');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'D' } });
  expect(c.ok(), await c.text()).toBe(true);
  const clientId = (await c.json()).data.id;

  const pr = await page.request.post(`${api}/projects`, {
    data: {
      key: 'DR',
      name: 'โปรเจกต์ทดสอบการหย่อน',
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
      board: [
        { key: 'c1', name: 'รอเริ่ม' },
        { key: 'c2', name: 'กำลังทำ' },
        { key: 'c3', name: 'เสร็จ' },
      ],
    },
  });
  expect(pr.ok(), await pr.text()).toBe(true);
  const pid = (await pr.json()).data.id;

  for (const t of ['การ์ดหนึ่ง', 'การ์ดสอง']) {
    const r = await page.request.post(`${api}/projects/${pid}/tasks`, {
      data: { title: t, type: 'task' },
    });
    expect(r.ok(), await r.text()).toBe(true);
  }

  await page.goto(`/app/${slug}/projects/DR/board`);
  await expect(page.locator('.tk').first()).toBeVisible({ timeout: 20000 });
  const col2 = page.locator('.bcol').nth(1);

  // ── ทางที่หนึ่ง · หย่อนที่พื้นที่ว่าง (เคสที่เคยทำงานอยู่แล้ว) ──
  const b2 = await col2.boundingBox();
  if (!b2) throw new Error('ไม่พบคอลัมน์ที่สอง');
  await dragCardTo(page, 'การ์ดหนึ่ง', b2.x + b2.width / 2, b2.y + b2.height - 25);
  // ย้ายทันทีที่ปล่อยเมาส์ ไม่มีกล่องยืนยันคั่นแล้ว
  await expect(col2.locator('.tk')).toHaveCount(1, { timeout: 15000 });

  // ── ทางที่สอง · หย่อน "ทับการ์ดใบอื่น" ⭐ เคสที่เคยเงียบ ──
  const target = await col2.locator('.tk').first().boundingBox();
  if (!target) throw new Error('ไม่พบการ์ดปลายทาง');
  await dragCardTo(page, 'การ์ดสอง', target.x + target.width / 2, target.y + target.height / 2);
  await expect(col2.locator('.tk'), 'หย่อนทับการ์ดใบอื่นต้องย้ายได้เหมือนหย่อนที่ว่าง').toHaveCount(2, {
    timeout: 15000,
  });

  // ยืนยันที่เซิร์ฟเวอร์ว่าย้ายจริง ไม่ใช่ขยับแค่บนจอ
  const ts = await page.request.get(`${api}/projects/${pid}/tasks`);
  const rows = (await ts.json()).data as { title: string; columnKey: string }[];
  expect(rows.every((r) => r.columnKey === 'c2')).toBe(true);
});

/**
 * ⭐ อาการที่สองที่ผู้ใช้แจ้ง — "กดการ์ดแล้วดูรายละเอียดไม่ได้"
 *
 * รากเดียวกับข้างบน · PointerSensor นับเป็นการลากตั้งแต่ขยับ 6px
 * การกดด้วยแทร็กแพดหรือนิ้วขยับเกินนั้นเป็นปกติ แล้ว dnd-kit กลืน event click ทิ้ง
 * วัดจริงบน build เก่า — นิ่งสนิทเปิดได้ · 4px เปิดได้ · 12px ไม่เกิดอะไรเลย
 */
test('กดการ์ดแบบมือขยับเกินเกณฑ์ ยังต้องเปิดลิ้นชักได้', async ({ page }) => {
  const email = `wobble-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัททดสอบการกด');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'W' } });
  const clientId = (await c.json()).data.id;
  const pr = await page.request.post(`${api}/projects`, {
    data: {
      key: 'WB',
      name: 'โปรเจกต์ทดสอบการกด',
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
  await page.request.post(`${api}/projects/${pid}/tasks`, {
    data: { title: 'การ์ดที่ต้องเปิดได้', type: 'task' },
  });

  await page.goto(`/app/${slug}/projects/WB/board`);
  const card = page.locator('.tk').first();
  await expect(card).toBeVisible({ timeout: 20000 });
  const b = await card.boundingBox();
  if (!b) throw new Error('ไม่พบการ์ด');
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;

  // กดแล้วมือขยับ 12px — เกินเกณฑ์ 6px ของ PointerSensor แต่ยังอยู่ในคอลัมน์เดิม
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 12, cy + 6, { steps: 5 });
  await page.mouse.up();

  await expect(page.locator('.ovl'), 'มือขยับเกิน 6px ตอนกด ต้องยังนับเป็นการคลิกดูรายละเอียด').toBeVisible({
    timeout: 10000,
  });
  // ชื่อเดียวกันอยู่ทั้งบนการ์ดและในลิ้นชัก จึงต้องเจาะจงว่าดูหัวข้อในลิ้นชัก
  await expect(page.locator('.ovl').getByRole('heading', { name: 'การ์ดที่ต้องเปิดได้' })).toBeVisible();
  expect(page.url()).toContain('card=');
});

/**
 * ⭐ บั๊กที่ทำให้ผู้ใช้เห็นว่า "กดการ์ดแล้วไม่มีอะไรเกิดขึ้น" บนบอร์ดจริง
 *
 * ลิ้นชักการ์ดกับกล่องยืนยันเคยยืมคลาส `.pw` ของพอร์ทัลมาใช้ ซึ่งเป็น layout
 * เต็มหน้า ไม่มี position: fixed กล่องจึงไหลไปต่อท้ายหน้า
 * บอร์ดที่มีการ์ดเยอะหน้าจะสูงมาก กล่องเลยไปโผล่ใต้บอร์ดทั้งกอง — นอกจอ
 *
 * เทสต์อื่นในไฟล์นี้ใช้บอร์ด 2 ใบ หน้าสั้นพอที่กล่องจะอยู่ในจอพอดี จึงไม่จับบั๊กนี้
 * เทสต์นี้จึงต้องมีการ์ดเยอะพอให้หน้าสูงเกินจอ แล้ววัดว่ากล่อง **อยู่ในกรอบจอจริง**
 * ไม่ใช่แค่ toBeVisible ซึ่งผ่านแม้ของจะอยู่ใต้เส้นขอบล่าง
 */
test('บอร์ดที่การ์ดเยอะจนหน้าสูงเกินจอ · ลิ้นชักต้องอยู่ในกรอบจอ', async ({ page }) => {
  const email = `tall-${Date.now()}@test.co`;
  await page.goto('/app/signup');
  await page.getByPlaceholder('ดิจิทัลเอ็กซ์ จำกัด').fill('บริษัทบอร์ดสูง');
  await page.getByPlaceholder('พีรพล วงศ์สถาพร').fill('ผู้ทดสอบ');
  await page.getByPlaceholder('peerapon@digitalx.co.th').fill(email);
  await page.locator('input[type="password"]').fill(PW);
  await page.getByRole('button', { name: 'สร้างที่ทำงาน' }).click();
  await page.waitForURL(/\/app\/[a-z0-9]{12}/, { timeout: 20000 });
  const slug = page.url().split('/app/')[1]?.split('/')[0] ?? '';
  const api = `/app/api/v1/t/${slug}`;

  const c = await page.request.post(`${api}/clients`, { data: { name: 'ลูกค้า', code: 'L' } });
  const clientId = (await c.json()).data.id;
  const pr = await page.request.post(`${api}/projects`, {
    data: {
      key: 'TL',
      name: 'บอร์ดการ์ดเยอะ',
      clientId,
      startsOn: '2026-01-01',
      dueOn: '2026-12-31',
      board: [
        { key: 'c1', name: 'รอเริ่ม' },
        { key: 'c2', name: 'กำลังทำ' },
        { key: 'c3', name: 'เสร็จ' },
      ],
    },
  });
  const pid = (await pr.json()).data.id;
  // การ์ดเยอะพอให้หน้ายาวเกินจอแน่ๆ — บอร์ดจริงของผู้ใช้มี 13 ใบ
  for (let i = 1; i <= 16; i++) {
    await page.request.post(`${api}/projects/${pid}/tasks`, {
      data: { title: `งานลำดับที่ ${i}`, type: 'task' },
    });
  }

  await page.goto(`/app/${slug}/projects/TL/board`);
  await expect(page.locator('.tk').first()).toBeVisible({ timeout: 20000 });

  const view = page.viewportSize();
  if (!view) throw new Error('ไม่ทราบขนาดจอ');
  // ⚠ ห้ามวัดด้วย documentElement.scrollHeight — หน้าเลื่อนในคอนเทนเนอร์ย่อย
  //   ค่านั้นจึงเท่ากับความสูงจอเสมอ แม้บอร์ดจะยาวเลยขอบล่างไปไกล
  //   ต้องวัดขอบล่างของคอลัมน์เทียบกรอบจอตรงๆ
  const columnBottom = await page
    .locator('.bcol')
    .first()
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(columnBottom, 'บอร์ดต้องยาวเลยขอบล่างจอ ไม่งั้นเทสต์นี้ไม่ได้พิสูจน์อะไร').toBeGreaterThan(view.height);

  await page.locator('.tk', { hasText: 'งานลำดับที่ 1' }).first().click();
  const drawer = page.locator('.ovl');
  await expect(drawer).toBeVisible({ timeout: 10000 });

  const box = await drawer.boundingBox();
  if (!box) throw new Error('ไม่พบลิ้นชัก');
  expect(box.y, 'ขอบบนของลิ้นชักต้องไม่หลุดใต้ขอบล่างของจอ').toBeLessThan(view.height);
  expect(box.y + box.height, 'ลิ้นชักต้องไม่ยาวเลยขอบล่างของจอ').toBeLessThanOrEqual(view.height + 1);
  expect(box.y, 'ขอบบนต้องไม่อยู่เหนือขอบจอ').toBeGreaterThanOrEqual(-1);
});
