'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';

/**
 * เมนูบัญชีมุมบนขวา — ใช้ที่หน้าที่อยู่**นอก**ที่ทำงาน (42 · 43)
 * หน้าที่อยู่ในที่ทำงานมีเมนูข้างของตัวเองอยู่แล้ว
 *
 * ═══ รูปโปรไฟล์ล้มกลับสามชั้น ═══
 * 1. รูปที่อัปไว้
 * 2. อักษรย่อจาก**ชื่อ**
 * 3. อักษรย่อจาก**อีเมล** — เผื่อกรณีที่ยังไม่มีชื่อ
 *
 * ตอนนี้ยังไม่ได้ต่อที่เก็บไฟล์ จึงยังอัปรูปไม่ได้ ทุกคนจะเห็นชั้นที่ 2
 * เขียนชั้นที่ 1 ไว้ก่อนเพราะพอต่อที่เก็บไฟล์แล้วจะได้ไม่ต้องกลับมาแก้ที่นี่อีก
 *
 * สีพื้นหลังคำนวณจาก id ของคน ไม่ได้สุ่ม — คนเดิมจึงได้สีเดิมทุกครั้งที่เปิด
 */
export interface AccountUser {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

const COLORS = ['#5B5BD6', '#0EA5A4', '#D97706', '#7C3AED', '#DC2626', '#2563EB'];

function colorOf(seed: string): string {
  let n = 0;
  for (const ch of seed) n += ch.charCodeAt(0);
  return COLORS[n % COLORS.length] as string;
}

/** ชื่อก่อน · ไม่มีชื่อค่อยใช้อีเมล · ตัดเอาสองตัวแรกที่ไม่ใช่ช่องว่าง */
export function initialsOf(user: { name?: string | null; email: string }): string {
  const name = (user.name ?? '').trim();
  if (name) {
    const words = name.split(/\s+/);
    // ชื่อไทยมักเขียนติดกัน เอาสองอักษรแรกของคำแรกจะอ่านออกกว่าอักษรแรกของสองคำ
    return (words[0] ?? name).slice(0, 2);
  }
  return user.email.slice(0, 2);
}

export function AccountMenu({ user }: { user: AccountUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // คลิกที่อื่นแล้วปิด · กด Esc แล้วปิด
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    router.push('/login');
  }

  if (!user) return <span className="who" />;

  return (
    <div className="who" ref={boxRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="acct-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {user.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: รูปมาจากที่เก็บไฟล์ภายนอก ไม่ผ่าน next/image
          <img className="acct-av" src={user.avatarUrl} alt="" />
        ) : (
          <span className="acct-av" style={{ background: colorOf(user.userId) }}>
            {initialsOf(user)}
          </span>
        )}
        <span className="acct-em mn">{user.email}</span>
        <span style={{ color: 'var(--faint)' }}>▾</span>
      </button>

      {open ? (
        <div className="acct-menu" role="menu">
          <div className="acct-head">
            <b>{user.name || user.email}</b>
            <span className="sub mn">{user.email}</span>
          </div>
          <Link href="/account" className="acct-item" role="menuitem">
            ⚙ ตั้งค่าบัญชี
          </Link>
          <button type="button" className="acct-item" role="menuitem" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      ) : null}
    </div>
  );
}
