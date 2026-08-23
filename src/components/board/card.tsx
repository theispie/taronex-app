'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, HeldTag } from '@/components/ui';
import type { BoardTask } from './types';

/**
 * การ์ดหนึ่งใบบนบอร์ด
 *
 * "ถือมา N วัน" ขึ้นเฉพาะเกิน 3 วัน — ถ้าขึ้นทุกใบตาจะชิน แล้วเลิกเห็น
 * การ์ดที่ปิดแล้วไม่ขึ้นป้ายนี้เลย เพราะไม่มีใครถืออยู่แล้ว
 */
export function BoardCard({
  task,
  showFeature,
  onOpen,
}: {
  task: BoardTask;
  showFeature: boolean;
  onOpen: (t: BoardTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="tk"
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'block',
          width: '100%',
          minWidth: 0,
        }}
      >
        <div className="cd mn">{task.code}</div>
        <div className="ti">{task.title}</div>
        <div className="mt">
          <Avatar
            member={
              task.assigneeId
                ? {
                    id: task.assigneeId,
                    name: task.assigneeName ?? '',
                    initials: (task.assigneeName ?? '?').slice(0, 2),
                    email: '',
                    role: 'member',
                    jobTitle: 'other',
                    active: true,
                  }
                : undefined
            }
            size="sm"
          />
          {showFeature ? (
            task.featureName ? (
              <span className="tag feat">{task.featureName}</span>
            ) : (
              <span className="tag out">งานนอกแผน</span>
            )
          ) : null}
          <span style={{ flex: 1 }} />
          {task.isClosed ? null : <HeldTag days={task.heldDays} />}
          {task.priority === 'critical' ? <span className="pr pr-critical">ด่วนมาก</span> : null}
        </div>
      </button>
    </div>
  );
}
