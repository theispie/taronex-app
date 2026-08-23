/**
 * ที่เก็บไฟล์แนบ — พูดภาษา S3
 *
 * ตอนพัฒนาชี้ไป MinIO · เครื่องจริงชี้ไป DigitalOcean Spaces
 * โค้ดชุดเดียวกันทั้งสองที่ ต่างกันแค่ค่าใน .env
 *
 * ═══ ทำไมต้อง presign ═══
 * ไฟล์แนบไม่ผ่านเซิร์ฟเวอร์ของเราเลย เบราว์เซอร์อัปโหลดตรงไปที่ที่เก็บไฟล์
 * เพราะเครื่องมี RAM 1 GB ถ้าไฟล์ 50 MB วิ่งผ่าน Next.js สักสองสามคนพร้อมกัน
 * เครื่องจะถูก OOM killer ฆ่าทันที
 */

import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError } from '@/lib/api/errors';

/** ลิงก์อัปโหลดอายุสั้น พอให้เลือกไฟล์แล้วส่ง ไม่ให้เอาไปแจกต่อ */
const UPLOAD_TTL = 300;
/** ลิงก์ดาวน์โหลดอายุ 5 นาทีตามที่สเปคระบุ */
const DOWNLOAD_TTL = 300;

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * ชนิดไฟล์ที่รับ — รายการอนุญาต ไม่ใช่รายการห้าม
 * รายการห้ามจะมีของหลุดเสมอ เพราะไม่มีใครนึกออกครบทุกนามสกุล
 */
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

let client: S3Client | null = null;

function s3(): S3Client {
  if (client) return client;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new ApiError('E_UNPROCESSABLE', 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์');
  }
  client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'sgp1',
    credentials: { accessKeyId, secretAccessKey },
    // MinIO ต้องใช้ path style · Spaces ใช้ virtual host style
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  });
  return client;
}

const bucket = () => process.env.S3_BUCKET ?? 'taronex-dev';

export function storageConfigured(): boolean {
  return Boolean(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
}

/**
 * คีย์ของไฟล์ขึ้นต้นด้วย tenant_id เสมอ
 * ทำให้ย้ายหรือลบข้อมูลของที่ทำงานหนึ่งได้ทั้งก้อนในวันที่เขาเลิกใช้
 * และเป็นชั้นกันพลาดเพิ่มถ้าวันหนึ่งมีบั๊กทำให้ id ไฟล์หลุดข้ามที่ทำงาน
 */
export function buildKey(tenantId: string, projectId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-฀-๿]/g, '_').slice(-120);
  return `${tenantId}/${projectId}/${randomUUID()}-${safe}`;
}

export function checkUpload(filename: string, mime: string, size: number): void {
  if (!filename.trim()) throw new ApiError('E_INVALID', 'ต้องมีชื่อไฟล์', 'filename');
  if (!ALLOWED_MIME.has(mime)) {
    throw new ApiError('E_INVALID', `ชนิดไฟล์ ${mime} ยังไม่รองรับ`, 'mime');
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new ApiError('E_INVALID', 'ขนาดไฟล์ไม่ถูกต้อง', 'size');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new ApiError('E_INVALID', 'ไฟล์ใหญ่เกิน 50 MB', 'size');
  }
}

export async function presignUpload(key: string, mime: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: mime }),
    {
      expiresIn: UPLOAD_TTL,
    },
  );
}

export async function presignDownload(key: string, filename: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      // บังคับให้เบราว์เซอร์บันทึกด้วยชื่อเดิม ไม่ใช่ชื่อคีย์ที่มี uuid ปน
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
    }),
    { expiresIn: DOWNLOAD_TTL },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
