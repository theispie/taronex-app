/**
 * แผนและโควตา — ที่เดียวในระบบที่รู้ตัวเลขเหล่านี้
 *
 * ═══ กฎข้อ 7 ═══
 * เกินโควตา ลดแผน ค้างชำระ ระงับบัญชี — **ปิดการเปิดของใหม่เท่านั้น**
 * ไม่มีเส้นทางไหนในระบบที่ลบข้อมูลผู้ใช้เพราะเรื่องเงิน
 * โปรเจกต์ที่เกินโควตาหลังลดแผนยังเปิดอ่านได้ตามปกติ แค่สร้างใหม่ไม่ได้
 *
 * เคยมีตัวเลขชุดนี้อยู่สองที่ (route ของ /plans กับตัวนับตอนปิดโปรเจกต์)
 * ซึ่งเป็นบั๊กรอเกิด — ย้ายมารวมที่นี่ที่เดียว
 */

export interface Plan {
  key: string;
  name: string;
  projects: number;
  seats: number;
  price: number;
}

export const PLANS: Plan[] = [
  { key: 'free', name: 'ฟรี', projects: 3, seats: 5, price: 0 },
  { key: 'team', name: 'ทีม', projects: 10, seats: 20, price: 590 },
  { key: 'business', name: 'ธุรกิจ', projects: 30, seats: 50, price: 1490 },
];

const FREE = PLANS[0] as Plan;

export function planOf(key: string): Plan {
  return PLANS.find((p) => p.key === key) ?? FREE;
}
