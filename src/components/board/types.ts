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
