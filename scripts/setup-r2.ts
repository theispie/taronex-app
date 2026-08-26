/**
 * ต่อ Cloudflare R2 ให้พร้อมใช้ — ทำทีเดียวจบ
 *
 * ═══ ทำไมเป็นสคริปต์ ไม่ใช่ให้กดในเว็บ ═══
 * การต่อที่เก็บไฟล์มีขั้นที่คนลืมประจำสองข้อ
 *   1. **CORS** — เบราว์เซอร์อัปไฟล์ตรงไปที่ R2 ถ้าไม่ตั้ง CORS จะโดนบล็อกทุกครั้ง
 *      และข้อความที่ขึ้นไม่ได้บอกว่าเป็นเพราะ CORS
 *   2. **ทดสอบวนครบรอบ** — เขียนได้อ่านได้ลบได้จริงไหม ไม่ใช่แค่ต่อติด
 * สคริปต์นี้ทำให้ทั้งสองข้อ แล้วบอกผลตรงๆ ว่าผ่านหรือไม่ผ่านตรงไหน
 *
 * ═══ ความลับไม่ผ่านหน้าจอและไม่ลง history ═══
 * รับค่าทางการพิมพ์ตอบเท่านั้น ไม่รับเป็นพารามิเตอร์บรรทัดคำสั่ง
 * เพราะพารามิเตอร์จะติดอยู่ใน `~/.bash_history` และใน `ps` ให้คนอื่นบนเครื่องเห็น
 *
 * ═══ ⏸ ยังไม่ได้ใช้ — ตั้งใจ ═══
 * ตัดสิน 25 ส.ค. 2569 · รอจดโดเมนจริงก่อนแล้วค่อยต่อ R2 ทีเดียว
 * เพราะ CORS ต้องระบุโดเมนที่เบราว์เซอร์ยิงมา ถ้าต่อตอนนี้แล้วเปลี่ยนโดเมนทีหลัง
 * ต้องมาแก้ CORS ใหม่อยู่ดี · สคริปต์นี้เตรียมไว้ให้รันได้ทันทีในวันนั้น
 *
 * วันที่จะใช้ ให้ตั้งโดเมนใหม่ก่อน:
 *   sudo TARONEX_ORIGINS=https://โดเมนใหม่ pnpm setup:r2
 *
 * ใช้:  sudo pnpm setup:r2
 */

import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ENV_FILE = process.env.TARONEX_ENV_FILE ?? '/etc/taronex/web.env';

/** โดเมนที่เบราว์เซอร์จะอัปไฟล์มาจาก — ต้องตรงเป๊ะ ไม่งั้น CORS ไม่ผ่าน */
const ORIGINS = (process.env.TARONEX_ORIGINS ?? 'https://taronex.theerawut.com')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const FILES_BUCKET = process.env.R2_FILES_BUCKET ?? 'taronex-files';
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET ?? 'taronex-backup';

const ok = (m: string) => console.info(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m: string) => console.info(`  \x1b[31m✕\x1b[0m ${m}`);
const step = (m: string) => console.info(`\n\x1b[1m▸ ${m}\x1b[0m`);

async function ask(rl: ReturnType<typeof createInterface>, q: string, secret = false) {
  if (!secret) return (await rl.question(q)).trim();

  // ปิดการแสดงตัวอักษรระหว่างพิมพ์ความลับ
  const out = process.stdout as NodeJS.WriteStream & { muted?: boolean };
  const original = out.write.bind(out);
  const answer = rl.question(q);
  out.write = ((chunk: string, ...rest: unknown[]) =>
    out.muted ? true : original(chunk, ...(rest as []))) as typeof out.write;
  out.muted = true;
  const value = await answer;
  out.muted = false;
  out.write = original;
  console.info('');
  return value.trim();
}

async function ensureBucket(s3: S3Client, name: string): Promise<'มีอยู่แล้ว' | 'สร้างใหม่'> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: name }));
    return 'มีอยู่แล้ว';
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: name }));
    return 'สร้างใหม่';
  }
}

async function roundTrip(s3: S3Client, bucket: string): Promise<void> {
  const key = `.taronex-selftest-${Date.now()}`;
  const body = 'ทดสอบเขียนอ่านลบ';

  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await got.Body?.transformToString();
  if (text !== body) throw new Error('อ่านกลับมาแล้วเนื้อไม่ตรงกับที่เขียนไป');
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** เขียนค่าลงไฟล์ env แบบแทนที่บรรทัดเดิม ไม่ใช่ต่อท้ายจนซ้ำ */
function writeEnv(values: Record<string, string>): void {
  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  if (existing) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    copyFileSync(ENV_FILE, `${ENV_FILE}.bak-${stamp}`);
  }

  let out = existing;
  for (const [k, v] of Object.entries(values)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    out = re.test(out) ? out.replace(re, line) : `${out.replace(/\n*$/, '\n')}${line}\n`;
  }
  writeFileSync(ENV_FILE, out, { mode: 0o600 });
  chmodSync(ENV_FILE, 0o600);
}

async function main() {
  console.info('\n\x1b[1mต่อ Cloudflare R2\x1b[0m');
  console.info('ต้องมีสามค่าจากแดชบอร์ด Cloudflare → R2 → Manage API Tokens');
  console.info('(ความลับที่พิมพ์จะไม่ขึ้นบนหน้าจอ และไม่ถูกเก็บใน history)\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const accountId = await ask(rl, 'Account ID: ');
    const accessKeyId = await ask(rl, 'Access Key ID: ');
    const secretAccessKey = await ask(rl, 'Secret Access Key (จะไม่แสดง): ', true);

    if (!accountId || !accessKeyId || !secretAccessKey) {
      bad('กรอกไม่ครบ — ยกเลิก ไม่แตะไฟล์ตั้งค่าเดิม');
      process.exit(1);
    }

    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const s3 = new S3Client({
      endpoint,
      // R2 ไม่มีภูมิภาค แต่ SDK บังคับให้ใส่ · 'auto' คือค่าที่ Cloudflare กำหนดให้ใช้
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    step('ตรวจการเชื่อมต่อและถังเก็บไฟล์');
    for (const b of [FILES_BUCKET, BACKUP_BUCKET]) {
      try {
        ok(`${b} · ${await ensureBucket(s3, b)}`);
      } catch (e) {
        bad(`${b} · ${e instanceof Error ? e.message : e}`);
        console.info('\n  โทเคนต้องมีสิทธิ์ "Object Read & Write" และขอบเขตครอบถังนี้');
        process.exit(1);
      }
    }

    step('ตั้ง CORS ให้เบราว์เซอร์อัปไฟล์ตรงได้');
    console.info(`  อนุญาตจาก: ${ORIGINS.join(' · ')}`);
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: FILES_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ORIGINS,
              // PUT สำหรับอัป · GET สำหรับดาวน์โหลด · HEAD ให้เบราว์เซอร์เช็คก่อน
              AllowedMethods: ['PUT', 'GET', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    ok('ตั้ง CORS ให้ถังไฟล์แนบแล้ว');
    // ถังสำรองไม่ต้องมี CORS — เข้าถึงจากเครื่องเท่านั้น ไม่มีเบราว์เซอร์เกี่ยวข้อง
    ok('ถังสำรองไม่ตั้ง CORS โดยตั้งใจ — เข้าจากเครื่องอย่างเดียว');

    step('ทดสอบเขียน อ่าน ลบ จริง');
    for (const b of [FILES_BUCKET, BACKUP_BUCKET]) {
      try {
        await roundTrip(s3, b);
        ok(`${b} · ครบรอบ`);
      } catch (e) {
        bad(`${b} · ${e instanceof Error ? e.message : e}`);
        process.exit(1);
      }
    }

    step(`บันทึกลง ${ENV_FILE}`);
    writeEnv({
      S3_ENDPOINT: endpoint,
      S3_REGION: 'auto',
      S3_BUCKET: FILES_BUCKET,
      S3_ACCESS_KEY: accessKeyId,
      S3_SECRET_KEY: secretAccessKey,
      S3_FORCE_PATH_STYLE: 'true',
      R2_BACKUP_BUCKET: BACKUP_BUCKET,
    });
    ok('เขียนแล้ว (สิทธิ์ 600 · สำรองไฟล์เดิมไว้ให้)');

    console.info('\n\x1b[32mเรียบร้อย\x1b[0m ขั้นต่อไป:');
    console.info('  sudo systemctl restart taronex-web');
    console.info('  curl -s https://taronex.theerawut.com/app/api/v1/meta/health');
    console.info('  sudo /opt/taronex-app/deploy/backup.sh   # จะส่งขึ้น R2 ให้เองแล้ว\n');
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  bad(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
