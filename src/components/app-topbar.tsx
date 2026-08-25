'use client';

import Link from 'next/link';
import { AccountMenu, type AccountUser } from '@/components/account-menu';

/**
 * แถบบนของหน้าที่อยู่**นอก**ที่ทำงาน — หน้าจอ 42 (ที่ทำงานของฉัน) และ 43 (ตั้งค่าบัญชี)
 *
 * สองหน้านี้เดินไปมาหากันตลอด ถ้าแถบบนไม่เหมือนกันจะรู้สึกเหมือนคนละระบบ
 * จึงรวมเป็นคอมโพเนนต์เดียว — แก้ที่นี่ที่เดียวแล้วเปลี่ยนพร้อมกันทั้งสองหน้า
 *
 * หน้าที่อยู่*ใน*ที่ทำงานไม่ใช้ตัวนี้ เพราะมีเมนูข้างของตัวเองอยู่แล้ว
 */
export function AppTopbar({ user }: { user: AccountUser | null }) {
  return (
    <div className="topbar">
      <Link
        href="/workspaces"
        style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'inherit' }}
      >
        <span className="mark">T</span>
        <b style={{ fontSize: 15 }}>TaroNex</b>
      </Link>
      <AccountMenu user={user} />
    </div>
  );
}
