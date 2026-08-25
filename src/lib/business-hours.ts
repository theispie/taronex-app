/**
 * เวลาทำการ — หัวใจของการคำนวณ SLA
 *
 * ═══ เกณฑ์ผ่านของ M10 อยู่ที่ไฟล์นี้ ═══
 * "แจ้งบ่าย 3 วันศุกร์ SLA 8 ชม. → ครบกำหนดบ่าย 2 วันจันทร์"
 * ศุกร์ 15:00 + 3 ชม. ถึง 18:00 · เสาร์อาทิตย์ไม่นับ · จันทร์ 09:00 + 5 ชม. = 14:00
 *
 * ═══ ทำไมต้องคำนวณเอง ไม่ใช้ไลบรารี ═══
 * ไลบรารีวันทำการที่มีอยู่ผูกกับปฏิทินตะวันตกและไม่รู้จักวันหยุดไทย
 * ตรรกะจริงมีแค่ "เดินหน้าทีละช่วงเวลาทำการ" ซึ่งเขียนเองสั้นกว่าการดัดไลบรารี
 * และไม่ต้องเพิ่มของที่ต้องดูแลบนเครื่อง 1 GB
 *
 * ทุกอย่างคิดในเขตเวลาของที่ทำงาน ไม่ใช่ UTC — ไม่งั้นเวลาทำการจะเลื่อน 7 ชั่วโมง
 */

export interface BusinessHours {
  /** 1 = จันทร์ … 7 = อาทิตย์ (ISO) */
  days: number[];
  /** "09:00" */
  start: string;
  /** "18:00" */
  end: string;
  /** "TH" = ใช้ตารางวันหยุดราชการไทย · อย่างอื่น = ไม่มีวันหยุด */
  holidays?: string;
}

export const DEFAULT_HOURS: BusinessHours = {
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '18:00',
  holidays: 'TH',
};

/**
 * วันหยุดราชการไทย
 *
 * ตั้งใจเก็บเป็นรายการตายตัว ไม่คำนวณจากปฏิทินจันทรคติ
 * เพราะวันหยุดหลายวัน (วิสาขบูชา อาสาฬหบูชา) ประกาศเป็นปีๆ ไป
 * และวันหยุดชดเชยขึ้นกับมติคณะรัฐมนตรี ซึ่งไม่มีสูตรตายตัว
 *
 * **ต้องเติมทุกปลายปี** ถ้าไม่เติม ระบบจะนับวันหยุดเป็นวันทำงาน
 * แล้ว SLA จะครบกำหนดเร็วกว่าที่ควร ซึ่งเป็นความผิดที่เข้าข้างลูกค้า
 * (ปลอดภัยกว่าเข้าข้างเรา แต่ก็ยังผิด)
 */
export const TH_HOLIDAYS = new Set<string>([
  // 2569 (2026)
  '2026-01-01',
  '2026-01-02',
  '2026-03-03',
  '2026-04-06',
  '2026-04-13',
  '2026-04-14',
  '2026-04-15',
  '2026-05-01',
  '2026-05-04',
  '2026-06-01',
  '2026-06-03',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-08-12',
  '2026-10-13',
  '2026-10-23',
  '2026-12-07',
  '2026-12-10',
  '2026-12-31',
  // 2570 (2027) — เติมเมื่อมีประกาศ
  '2027-01-01',
]);

const MIN = 60_000;

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** แปลงเวลา UTC เป็นเวลาท้องถิ่นของที่ทำงาน โดยไม่ต้องพึ่ง Intl ที่หนัก */
function toLocal(at: Date, tzOffsetMinutes: number): Date {
  return new Date(at.getTime() + tzOffsetMinutes * MIN);
}
function toUtc(local: Date, tzOffsetMinutes: number): Date {
  return new Date(local.getTime() - tzOffsetMinutes * MIN);
}

const isoDay = (d: Date) => (d.getUTCDay() === 0 ? 7 : d.getUTCDay());
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

function isWorkday(local: Date, hours: BusinessHours): boolean {
  if (!hours.days.includes(isoDay(local))) return false;
  if (hours.holidays === 'TH' && TH_HOLIDAYS.has(dateKey(local))) return false;
  return true;
}

/**
 * เวลาทำการที่ผ่านไประหว่างสองจุด (นาที)
 * ใช้รวมยอดของช่วงที่นาฬิกาเดิน
 */
export function businessMinutesBetween(
  from: Date,
  to: Date,
  hours: BusinessHours = DEFAULT_HOURS,
  tzOffsetMinutes = 420,
): number {
  if (to <= from) return 0;
  const startMin = minutesOfDay(hours.start);
  const endMin = minutesOfDay(hours.end);
  if (endMin <= startMin) return 0;

  let total = 0;
  const cur = toLocal(from, tzOffsetMinutes);
  const end = toLocal(to, tzOffsetMinutes);

  // เดินทีละวัน · วันแรกกับวันสุดท้ายตัดตามเวลาจริง
  const day = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()));
  while (day <= end) {
    if (isWorkday(day, hours)) {
      const open = new Date(day.getTime() + startMin * MIN);
      const close = new Date(day.getTime() + endMin * MIN);
      const a = cur > open ? cur : open;
      const b = end < close ? end : close;
      if (b > a) total += Math.floor((b.getTime() - a.getTime()) / MIN);
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return total;
}

/**
 * บวกเวลาทำการเข้าไปแล้วคืนเวลาจริงที่ครบกำหนด
 *
 * ถ้าจุดเริ่มอยู่นอกเวลาทำการ ให้ขยับไปต้นเวลาทำการถัดไปก่อน
 * เช่นลูกค้าแจ้งตอนตีสอง นาฬิกาเริ่มนับตอน 09:00 ของวันทำการถัดไป
 */
export function addBusinessMinutes(
  from: Date,
  minutes: number,
  hours: BusinessHours = DEFAULT_HOURS,
  tzOffsetMinutes = 420,
): Date {
  const startMin = minutesOfDay(hours.start);
  const endMin = minutesOfDay(hours.end);
  if (endMin <= startMin || minutes < 0) return from;

  let left = minutes;
  let cur = toLocal(from, tzOffsetMinutes);

  // กันลูปไม่รู้จบถ้ามีคนตั้งวันทำการเป็นชุดว่าง หรือวันหยุดกินทั้งปี
  for (let guard = 0; guard < 3650; guard++) {
    const day = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate()));
    if (isWorkday(day, hours)) {
      const open = new Date(day.getTime() + startMin * MIN);
      const close = new Date(day.getTime() + endMin * MIN);
      const at = cur < open ? open : cur;

      if (at < close) {
        const available = Math.floor((close.getTime() - at.getTime()) / MIN);
        if (left <= available) {
          return toUtc(new Date(at.getTime() + left * MIN), tzOffsetMinutes);
        }
        left -= available;
      }
    }
    // ไปต้นวันถัดไป
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate() + 1));
    cur = next;
  }
  // ถ้ามาถึงตรงนี้แปลว่าตั้งค่าเวลาทำการไว้จนหาไม่เจอใน 10 ปี
  return toUtc(cur, tzOffsetMinutes);
}

/** ขยับไปต้นเวลาทำการถัดไป ถ้าอยู่นอกเวลาทำการอยู่แล้ว */
export function nextBusinessStart(
  at: Date,
  hours: BusinessHours = DEFAULT_HOURS,
  tzOffsetMinutes = 420,
): Date {
  return addBusinessMinutes(at, 0, hours, tzOffsetMinutes);
}
