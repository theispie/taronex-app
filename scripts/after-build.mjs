import { access, cp } from 'node:fs/promises';
import path from 'node:path';

/**
 * คัดลอก static กับ public เข้า .next/standalone
 *
 * ═══ ทำไมต้องมีขั้นนี้ ═══
 * `output: 'standalone'` สร้างโฟลเดอร์ที่รันได้ด้วยตัวเอง แต่ Next **ไม่คัดลอก**
 * `.next/static` กับ `public` ให้ เพราะปกติสองอย่างนี้ให้ CDN เสิร์ฟ
 *
 * เราไม่มี CDN — nginx ส่งทุกอย่างเข้า Next ตัวเดียว
 * ถ้าไม่คัดลอก ทุกไฟล์ CSS/JS จะคืน 404 แล้วเว็บจะเสิร์ฟเป็น HTML เปล่าๆ
 * ไม่มีสไตล์ ไม่มีปุ่มที่กดได้ **และหน้าเว็บยังคืน 200 อยู่**
 * จึงไม่มีทางเห็นด้วยการยิง curl ดูรหัสตอบกลับ — ต้องเปิดเบราว์เซอร์จริงเท่านั้น
 */
const root = process.cwd();
const standalone = path.join(root, '.next', 'standalone');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copy(from, to, label) {
  if (!(await exists(from))) {
    console.log(`ข้าม ${label} — ไม่มี ${from}`);
    return;
  }
  await cp(from, to, { recursive: true, force: true });
  console.log(`คัดลอก ${label} → ${path.relative(root, to)}`);
}

if (!(await exists(standalone))) {
  console.log('ไม่มี .next/standalone — ข้ามขั้นนี้');
  process.exit(0);
}

await copy(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), 'static');
await copy(path.join(root, 'public'), path.join(standalone, 'public'), 'public');
