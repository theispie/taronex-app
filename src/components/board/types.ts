/** ชนิดข้อมูลที่บอร์ดใช้ร่วมกัน */

export interface BoardTask {
  id: string;
  code: string;
  title: string;
  columnKey: string;
  columnIndex: number;
  featureId: string | null;
  featureName: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  priority: string;
  heldDays: number;
  isClosed: boolean;
}

export interface BoardColumn {
  key: string;
  name: string;
}

export interface BoardMember {
  userId: string;
  name: string;
  holding: number;
}

/**
 * โทนสีจากตำแหน่ง ไม่ได้เก็บไว้ที่คอลัมน์ (กฎข้อ 8)
 * คอลัมน์ก่อนสุดท้ายใช้สีของขั้นตรวจ เพราะบอร์ดส่วนใหญ่วางขั้นตรวจไว้ตรงนั้น
 * เป็นแค่เรื่องสี ไม่มีผลกับกติกาใดๆ
 */
export function columnTone(index: number, total: number): string {
  if (index === 0) return 'st-todo';
  if (index === total - 1) return 'st-done';
  if (index === total - 2 && total >= 3) return 'st-review';
  return 'st-doing';
}

/**
 * คอลัมน์ปลายทางของการหย่อน
 *
 * ═══ หย่อนทับการ์ดใบอื่นก็ต้องนับ ═══
 * dnd-kit คืน `over` เป็นตัวรับที่อยู่ใต้เมาส์ตอนปล่อย และ `useSortable`
 * ลงทะเบียนการ์ดทุกใบเป็นตัวรับในตัวมันเอง หย่อนทับการ์ดจึงได้ id ของการ์ดใบนั้น
 * ไม่ใช่ `col:xxx`
 *
 * โค้ดเดิมเห็นว่าไม่ขึ้นต้นด้วย `col:` แล้วเงียบไปเฉยๆ ผลคือย้ายได้เฉพาะตอนหย่อนโดน
 * "พื้นที่ว่าง" ของคอลัมน์ ซึ่งคอลัมน์ที่การ์ดเต็มแทบไม่เหลือที่ว่างให้โดนเลย
 * คนใช้จึงเห็นว่าลากข้ามคอลัมน์ไม่ได้ — และเทสต์เดิมไม่จับ เพราะมันหย่อนที่ว่างเสมอ
 *
 * ตำแหน่งภายในคอลัมน์ไม่มีความหมายในระบบนี้ (ไม่มี `sort_order` โดยตั้งใจ)
 * หย่อนทับการ์ดใบไหนจึงแปลว่า "เอาไปไว้คอลัมน์เดียวกับใบนั้น" เท่านั้น
 */
export function dropColumnKey(
  overId: string,
  tasks: Pick<BoardTask, 'id' | 'columnKey'>[],
): string | null {
  if (overId.startsWith('col:')) return overId.slice(4);
  return tasks.find((t) => t.id === overId)?.columnKey ?? null;
}
