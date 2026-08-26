/**
 * ส่งอีเมลผ่าน Resend
 *
 * ═══ ทำไมไม่ลง SDK ของ Resend ═══
 * SDK มีไว้ห่อ HTTP POST เส้นเดียว ซึ่ง `fetch` ทำได้ในสิบบรรทัด
 * เครื่องมี RAM 961 MB และทุก dependency คือของที่ต้องตามแพตช์ต่อไปตลอด
 * ถ้าวันหนึ่งต้องใช้ batch หรือ attachment ค่อยลง SDK ตอนนั้น
 *
 * ═══ ⚠ ส่งอีเมลล้มต้องไม่ทำให้งานหลักล้ม ═══
 * มอบหมายงานสำเร็จแล้วแต่ส่งอีเมลไม่ออก = งานยังถูกมอบหมาย
 * ถ้าโยนข้อผิดพลาดขึ้นไป ธุรกรรมจะถูกยกเลิกทั้งก้อน แล้วการมอบหมายจะหายไปด้วย
 * ซึ่งแย่กว่าไม่ได้อีเมลมาก · ฟังก์ชันนี้จึง **ไม่โยนข้อผิดพลาดออกไปเลย**
 * คืนผลว่าสำเร็จหรือไม่ แล้วให้ตัวเรียกตัดสินใจว่าจะบันทึกอะไรต่อ
 *
 * ═══ ⚠ ตอนนี้ยังส่งหาลูกค้าจริงไม่ได้ ═══
 * บัญชี Resend ยังไม่ได้ยืนยันโดเมน ผู้ส่ง `onboarding@resend.dev`
 * **ส่งได้เฉพาะไปที่อีเมลเจ้าของบัญชีเท่านั้น** (ยืนยันแล้วด้วยการยิงจริง — ได้ 403)
 *
 * ระหว่างนี้ตั้ง `EMAIL_REDIRECT_TO` ไว้ อีเมลทุกฉบับจะถูกส่งไปที่อยู่นั้นแทน
 * พร้อมบอกในหัวเรื่องว่าที่จริงส่งถึงใคร — ทำให้ทดสอบทั้งเส้นทางได้จริงวันนี้
 * พอยืนยันโดเมนแล้วให้ลบตัวแปรนั้นทิ้ง ไม่ต้องแก้โค้ดสักบรรทัด
 */

const API = 'https://api.resend.com/emails';

export interface SendResult {
  sent: boolean;
  /** id ของ Resend เมื่อส่งสำเร็จ · ข้อความอธิบายเมื่อไม่สำเร็จ */
  detail: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** ที่อยู่ของแอปสำหรับประกอบลิงก์ในอีเมล */
export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000/app').replace(/\/$/, '');
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // ตอนพัฒนา — ไม่ต้องมีคีย์ก็ทดสอบเส้นทางได้ ลิงก์โผล่ในบันทึกเซิร์ฟเวอร์
    console.warn(`[email] ยังไม่ได้ตั้ง RESEND_API_KEY · ถึง ${input.to} · ${input.subject}`);
    return { sent: false, detail: 'ยังไม่ได้ตั้งคีย์' };
  }

  const redirect = process.env.EMAIL_REDIRECT_TO?.trim();
  const to = redirect || input.to;
  const subject = redirect ? `[ถึง ${input.to}] ${input.subject}` : input.subject;

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'TaroNex <onboarding@resend.dev>',
        to,
        subject,
        html: input.html,
        text: input.text,
      }),
      // อีเมลไม่ควรถ่วงคำขอของผู้ใช้เกินสองสามวินาที
      signal: AbortSignal.timeout(8000),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.warn(`[email] ส่งไม่สำเร็จ ${res.status} · ${body.message ?? ''}`);
      return { sent: false, detail: body.message ?? `HTTP ${res.status}` };
    }
    return { sent: true, detail: body.id ?? 'ส่งแล้ว' };
  } catch (e) {
    console.warn(`[email] ส่งไม่สำเร็จ · ${e instanceof Error ? e.message : e}`);
    return { sent: false, detail: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ' };
  }
}
