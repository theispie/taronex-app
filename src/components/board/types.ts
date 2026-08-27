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
  /** ลำดับในคอลัมน์ · เลขทศนิยมเพื่อให้แทรกกลางได้โดยไม่ต้องเขียนใหม่ทั้งคอลัมน์ */
  position: number;
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

/** ระยะห่างมาตรฐานตอนต่อท้ายคอลัมน์ — เว้นช่องไว้ให้แทรกกลางได้อีกหลายชั้น */
const GAP = 1024;

/**
 * ⭐ ตำแหน่งใหม่ของการ์ดที่หย่อนลงระหว่างการ์ดสองใบ
 *
 * ═══ ทำไมเป็นเลขทศนิยม ไม่ใช่ 1, 2, 3 ═══
 * ถ้าเก็บเป็นลำดับจำนวนเต็ม การแทรกกลางหนึ่งครั้งต้องเขียนทับการ์ดทุกใบที่อยู่ใต้ลงไป
 * บอร์ดที่มีร้อยใบก็เขียนร้อยแถวต่อการลากหนึ่งครั้ง แล้วสองคนลากพร้อมกันเมื่อไรก็ทับกัน
 *
 * ค่ากลางระหว่างเพื่อนบ้านสองใบทำให้การลากหนึ่งครั้งเขียนแค่ **แถวเดียว** เสมอ
 * `double precision` มีความละเอียดพอให้แทรกซ้ำที่เดิมได้ราวห้าสิบชั้นก่อนจะชนขีดจำกัด
 * ซึ่งเกินกว่าที่คนจะลากซ้ำจุดเดิมในทางปฏิบัติมาก
 */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return GAP;
  if (prev === null) return (next as number) - GAP;
  if (next === null) return prev + GAP;
  return (prev + next) / 2;
}

/**
 * การ์ดที่หย่อนควรไปแทรกที่ช่องไหนของคอลัมน์ปลายทาง
 *
 * `list` คือการ์ดในคอลัมน์ปลายทางเรียงตามลำดับปัจจุบัน **ไม่นับใบที่กำลังลาก**
 * หย่อนทับการ์ดใบไหนแล้วจะไปอยู่บนหรือล่างของใบนั้น ตัดสินจากว่าจุดกึ่งกลางของ
 * การ์ดที่ลากอยู่เหนือหรือใต้จุดกึ่งกลางของใบที่ถูกทับ — ตรงกับที่ตาเห็นตอนลาก
 */
export function dropIndex(
  list: { id: string }[],
  overId: string,
  activeCenterY: number | null,
  overCenterY: number | null,
): number {
  if (overId.startsWith('col:')) return list.length; // หย่อนที่ว่าง = ต่อท้าย
  const i = list.findIndex((t) => t.id === overId);
  if (i < 0) return list.length;
  if (activeCenterY === null || overCenterY === null) return i;
  return activeCenterY > overCenterY ? i + 1 : i;
}
