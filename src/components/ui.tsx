import type { ReactNode } from 'react';
import type { Member, Tone } from '@/lib/types';

/** สีอวาตาร์ตามต้นแบบ — วนจากรหัสผู้ใช้ ไม่ได้คิดสีใหม่ */
const AV_COLORS = ['#5B5BD6', '#DC2626', '#0EA5A4', '#D97706', '#2563EB'];

export function avatarColor(id: string): string {
  let n = 0;
  for (const ch of id) n += ch.charCodeAt(0);
  return AV_COLORS[n % AV_COLORS.length] as string;
}

export function Avatar({ member, size = 'md' }: { member?: Member; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'sm' ? 'av av-sm' : size === 'lg' ? 'av av-lg' : 'av';
  if (!member) {
    return (
      <span
        className={cls}
        style={{ background: 'transparent', border: '1px dashed var(--line)', color: 'var(--faint)' }}
        title="ยังไม่มีผู้รับผิดชอบ"
      >
        ?
      </span>
    );
  }
  return (
    <span className={cls} style={{ background: avatarColor(member.id) }} title={member.name}>
      {member.initials}
    </span>
  );
}

/** ป้ายคอลัมน์ — สีมาจากตำแหน่งของคอลัมน์ ไม่ได้มาจากค่าที่เก็บไว้ */
export function ColumnChip({ tone, label }: { tone: Tone; label: string }) {
  return <span className={`chip st-${tone}`}>{label}</span>;
}

/** ป้ายบอกอาการ ไม่ใช่ชื่อธง — ขึ้นเฉพาะเมื่อเกิน 3 วัน ไม่งั้นตาจะชิน */
export function HeldTag({ days }: { days: number }) {
  if (days <= 3) return null;
  return <span className="tag hold">ค้าง {days} ว.</span>;
}

export function PageHead({
  title, desc, right,
}: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        <h1>{title}</h1>
        {desc ? <div className="d">{desc}</div> : null}
      </div>
      {right ? <div className="r">{right}</div> : null}
    </div>
  );
}

export function Card({
  children, className = '', style,
}: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function CardHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="card-h">
      <b>{title}</b>
      {right ? <div className="r">{right}</div> : null}
    </div>
  );
}

/** แถบบอกว่าหน้านี้ยังไม่ต่อข้อมูลจริง */
export function MockNotice() {
  return (
    <div className="alert w" style={{ marginBottom: 14 }}>
      <span>⚠</span>
      <div>หน้าจอช่วงพัฒนา — ข้อมูลเป็นตัวอย่าง ยังไม่ได้ต่อฐานข้อมูลและ API</div>
    </div>
  );
}
