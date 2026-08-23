'use client';

import Link from 'next/link';

/**
 * แถวการ์ดที่ใช้ซ้ำในทุกมุมมองรวม (หน้าแรก · งานที่ได้รับ · ค้นหา · ปฏิทิน · ภาพรวมทีม)
 *
 * "ถือมา N วัน" ขึ้นเฉพาะเกิน 3 วัน — ถ้าขึ้นทุกใบตาจะชิน แล้วเลิกเห็น
 * การ์ดที่ปิดแล้วไม่ขึ้นเลย เพราะไม่มีใครถืออยู่
 */
export interface TaskRowData {
  id: string;
  code: string;
  title: string;
  projectKey: string;
  columnName: string;
  columnIndex: number;
  columnCount: number;
  isClosed: boolean;
  assigneeName: string | null;
  featureName: string | null;
  dueDate: string | null;
  heldDays: number;
}

function tone(i: number, total: number): string {
  if (i === 0) return 'st-todo';
  if (i === total - 1) return 'st-done';
  if (i === total - 2 && total >= 3) return 'st-review';
  return 'st-doing';
}

export function TaskRow({
  task,
  tenant,
  showAssignee = true,
}: {
  task: TaskRowData;
  tenant: string;
  showAssignee?: boolean;
}) {
  return (
    <div className="row">
      <Link href={`/${tenant}/tickets/${task.code}`} className="mn" style={{ minWidth: 76 }}>
        {task.code}
      </Link>
      <span className="row-title">{task.title}</span>
      <span className={`chip ${tone(task.columnIndex, task.columnCount)}`}>{task.columnName}</span>
      {showAssignee ? <span className="sub">{task.assigneeName ?? 'ยังไม่มีคนถือ'}</span> : null}
      {task.dueDate ? <span className="sub mn">{task.dueDate}</span> : null}
      {!task.isClosed && task.heldDays > 3 ? (
        <span className="tag hold">ถือมา {task.heldDays} ว.</span>
      ) : null}
    </div>
  );
}
