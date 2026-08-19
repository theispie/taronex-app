import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Member, TaskStatus } from '@/lib/types';

export function Avatar({ member, size = 28 }: { member?: Member; size?: number }) {
  if (!member) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-dashed border-line text-faint"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        title="ยังไม่มีผู้รับผิดชอบ"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={member.name}
    >
      {member.initials}
    </span>
  );
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  todo: 'bg-todo-bg text-todo',
  doing: 'bg-doing-bg text-doing',
  review: 'bg-review-bg text-review',
  done: 'bg-done-bg text-done',
};

export function StatusPill({ status, label }: { status: TaskStatus; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {label}
    </span>
  );
}

/** ป้ายบอกอาการ ไม่ใช่ชื่อธง — "ค้าง 4 ว." ไม่ใช่ "stale" */
export function HeldFlag({ days }: { days: number }) {
  if (days <= 3) return null;
  return (
    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium text-warn">
      ค้าง {days} ว.
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-surface shadow-1 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Button({
  children, href, variant = 'default', disabled, title,
}: {
  children: ReactNode; href?: string;
  variant?: 'default' | 'primary' | 'ghost'; disabled?: boolean; title?: string;
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors';
  const style =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-600'
      : variant === 'ghost'
        ? 'text-ink-2 hover:bg-line-2'
        : 'border border-line bg-surface text-ink-2 hover:bg-surface-2';
  const cls = `${base} ${style} ${disabled ? 'pointer-events-none opacity-50' : ''}`;
  if (href && !disabled) return <Link href={href} className={cls} title={title}>{children}</Link>;
  return <button type="button" className={cls} disabled={disabled} title={title}>{children}</button>;
}

/** แถบบอกว่าหน้านี้ยังไม่ต่อข้อมูลจริง */
export function MockNotice() {
  return (
    <div className="mb-4 rounded-md border border-line bg-warn-bg px-3 py-2 text-xs text-warn">
      หน้าจอช่วงพัฒนา — ข้อมูลบนหน้านี้เป็นตัวอย่าง ยังไม่ได้ต่อฐานข้อมูลและ API
    </div>
  );
}
