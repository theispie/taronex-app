/**
 * พจนานุกรม — ไทยเป็นต้นฉบับ อังกฤษเป็นคำแปล
 *
 * `Dict` เอาโครงจากพจนานุกรมไทย ดังนั้นถ้าเพิ่มคำไทยแล้วลืมเพิ่มอังกฤษ
 * TypeScript จะฟ้องตอน build ไม่ปล่อยให้หลุดขึ้นเครื่องจริง
 *
 * ⚠ ข้อความที่สเปคเขียนว่า "ห้ามแปลใหม่" ให้แปลอังกฤษตามความหมาย
 *   แต่**ห้ามแก้ต้นฉบับไทย** เช่น "ไม่มีความเคลื่อนไหว" ห้ามเปลี่ยนเป็น "ไม่มีผลงาน"
 */

import type { Locale } from './types';

export const th = {
  // ── เปลือกและเมนู ──
  'nav.myWork': 'งานของฉัน',
  'nav.home': 'หน้าแรก',
  'nav.myTasks': 'งานที่ได้รับ',
  'nav.calendar': 'ปฏิทินกำหนดส่ง',
  'nav.notifications': 'การแจ้งเตือน',
  'nav.team': 'ทีม',
  'nav.projects': 'โปรเจกต์',
  'nav.teamOverview': 'ภาพรวมทีม',
  'nav.activity': 'กิจกรรม',
  'nav.clients': 'ลูกค้า',
  'nav.clientsGroup': 'ลูกค้า',
  'nav.sla': 'งานประกัน / SLA',
  'nav.triage': 'คิวคัดแยก',
  'nav.later': 'ภายหลัง',
  'nav.timeLog': 'ลงเวลา',
  'nav.reports': 'รายงาน',
  'nav.settingsGroup': 'ตั้งค่า',
  'nav.templates': 'แม่แบบ',
  'nav.myProfile': 'โปรไฟล์ของฉัน',
  'nav.limits': 'โควตาและแผน',
  'nav.workspaceSettings': 'ตั้งค่าที่ทำงาน',
  'shell.search': 'ค้นหาทิกเก็ต โปรเจกต์…',
  'shell.notifications': 'การแจ้งเตือน',

  // ── บทบาท ──
  'role.owner': 'เจ้าของ',
  'role.ownerLong': 'เจ้าของที่ทำงาน',
  'role.member': 'สมาชิก',
  'role.viewer': 'ผู้ชม',
  'role.guest': 'แขก',

  // ── เมนูบัญชี ──
  'account.settings': 'ตั้งค่าบัญชี',
  'account.logout': 'ออกจากระบบ',
  'account.language': 'ภาษา',

  // ── หน้ากลาง (42) ──
  'ws.greeting': 'สวัสดี',
  'ws.title': 'ที่ทำงานของฉัน',
  'ws.choose': 'เลือกที่ทำงานที่ต้องการเข้า',
  'ws.yours': 'ที่ทำงานของคุณ',
  'ws.create': 'สร้างที่ทำงานใหม่',
  'ws.createName': 'ชื่อบริษัท / ทีม',
  'ws.createHint': 'เปลี่ยนทีหลังได้ที่หน้าตั้งค่าที่ทำงาน',
  'ws.save': 'สร้าง',
  'ws.cancel': 'ยกเลิก',
  'ws.waitingOnYou': 'รอคุณ',
  'ws.members': 'สมาชิก',
  'ws.projects': 'โปรเจกต์',
  'ws.trial': 'ทดลองใช้',
  'ws.seeProjects': 'เห็น {n} โปรเจกต์',
  'ws.readOnly': 'ดูได้อย่างเดียว',
  'ws.empty': 'ยังไม่ได้อยู่ที่ทำงานไหน — สร้างใหม่ได้เลย หรือถ้ามีทีมที่จะเข้าร่วม ให้รอคำเชิญจากเขา',
  'ws.inviteWaiting': 'คำเชิญที่รอคุณตอบ',
  'ws.inviteAs': 'เชิญเป็น',
  'ws.inviteBy': 'เชิญเป็น',
  'ws.daysLeft': 'เหลือเวลาอีก {n} วัน',
  'ws.inviteHint': 'รับคำเชิญได้จากลิงก์ในอีเมลเท่านั้น — ลิงก์คือหลักฐานว่าคำเชิญนี้ส่งถึงคุณจริง',
  'ws.inviteHint2': 'ตอนนี้ยังไม่ได้ต่อบริการส่งอีเมล ถ้ายังไม่ได้รับ ให้ขอลิงก์จากคนที่เชิญโดยตรง',
  'ws.foot': 'เข้าที่ทำงานใหม่ได้ด้วยคำเชิญเท่านั้น · ระบบไม่มีรายชื่อบริษัทให้ค้นหา',
  'ws.loading': 'กำลังโหลด…',

  // ── ตั้งค่าบัญชี (43) ──
  'acct.title': 'ตั้งค่าบัญชี',
  'acct.desc': 'ข้อมูลของคุณ ไม่ใช่ของที่ทำงานใดที่ทำงานหนึ่ง',
  'acct.avatar': 'รูปโปรไฟล์',
  'acct.upload': 'อัปโหลดรูป',
  'acct.change': 'เปลี่ยนรูป',
  'acct.remove': 'เอารูปออก',
  'acct.avatarHint': 'PNG · JPG · WebP ไม่เกิน 512 KB · ไม่รับ SVG เพราะเปิดช่องให้ฝังสคริปต์ได้',
  'acct.avatarHint2': 'ไม่อัปก็ได้ — ระบบจะใช้อักษรย่อจากชื่อคุณ (ไทยหรืออังกฤษก็ได้) ถ้าไม่มีชื่อจะใช้สองตัวแรกของอีเมล',
  'acct.avatarSaved': 'เปลี่ยนรูปโปรไฟล์แล้ว',
  'acct.avatarRemoved': 'เอารูปออกแล้ว · กลับไปใช้อักษรย่อ',
  'acct.avatarTooBig': 'รูปโปรไฟล์ต้องไม่เกิน 512 KB — ลองย่อรูปก่อนอัป',
  'acct.profile': 'ข้อมูลส่วนตัว',
  'acct.name': 'ชื่อ',
  'acct.email': 'อีเมล',
  'acct.emailHint': 'เปลี่ยนอีเมลยังทำไม่ได้ในเวอร์ชันนี้',
  'acct.languageHint': 'เปลี่ยนแล้วมีผลทันที และติดไปกับบัญชีของคุณทุกเครื่อง',
  'acct.save': 'บันทึก',
  'acct.saved': 'บันทึกชื่อแล้ว',
  'acct.changePassword': 'เปลี่ยนรหัสผ่าน',
  'acct.passwordWarn': 'เปลี่ยนแล้วทุกเครื่องที่ค้างอยู่จะถูกให้ออกจากระบบ รวมเครื่องนี้ด้วย',
  'acct.currentPassword': 'รหัสผ่านเดิม',
  'acct.newPassword': 'รหัสผ่านใหม่',
  'acct.passwordHint': 'อย่างน้อย 10 ตัวอักษร',
  'acct.back': '← กลับไปหน้าที่ทำงานของฉัน',
} as const;

export type DictKey = keyof typeof th;
export type Dict = Record<DictKey, string>;

export const en: Dict = {
  'nav.myWork': 'My work',
  'nav.home': 'Home',
  'nav.myTasks': 'Assigned to me',
  'nav.calendar': 'Due dates',
  'nav.notifications': 'Notifications',
  'nav.team': 'Team',
  'nav.projects': 'Projects',
  'nav.teamOverview': 'Team overview',
  'nav.activity': 'Activity',
  'nav.clients': 'Clients',
  'nav.clientsGroup': 'Clients',
  'nav.sla': 'Warranty / SLA',
  'nav.triage': 'Triage queue',
  'nav.later': 'Later',
  'nav.timeLog': 'Time log',
  'nav.reports': 'Reports',
  'nav.settingsGroup': 'Settings',
  'nav.templates': 'Templates',
  'nav.myProfile': 'My profile',
  'nav.limits': 'Plan & quota',
  'nav.workspaceSettings': 'Workspace settings',
  'shell.search': 'Search tickets, projects…',
  'shell.notifications': 'Notifications',

  'role.owner': 'Owner',
  'role.ownerLong': 'Workspace owner',
  'role.member': 'Member',
  'role.viewer': 'Viewer',
  'role.guest': 'Guest',

  'account.settings': 'Account settings',
  'account.logout': 'Sign out',
  'account.language': 'Language',

  'ws.greeting': 'Hello',
  'ws.title': 'My workspaces',
  'ws.choose': 'Choose a workspace to open',
  'ws.yours': 'Your workspaces',
  'ws.create': 'Create workspace',
  'ws.createName': 'Company / team name',
  'ws.createHint': 'You can change this later in workspace settings',
  'ws.save': 'Create',
  'ws.cancel': 'Cancel',
  'ws.waitingOnYou': 'Waiting on you',
  'ws.members': 'members',
  'ws.projects': 'projects',
  'ws.trial': 'trial',
  'ws.seeProjects': 'Sees {n} projects',
  'ws.readOnly': 'Read only',
  'ws.empty':
    "You're not in any workspace yet — create one, or wait for an invitation from the team you're joining.",
  'ws.inviteWaiting': 'Invitations waiting for you',
  'ws.inviteAs': 'invited you as',
  'ws.inviteBy': 'Invited as',
  'ws.daysLeft': '{n} days left',
  'ws.inviteHint':
    'Invitations can only be accepted from the link in the email — the link is the proof it was sent to you.',
  'ws.inviteHint2':
    "Email delivery isn't connected yet. If you haven't received it, ask the person who invited you for the link.",
  'ws.foot':
    'New workspaces are joined by invitation only · there is no company directory to search',
  'ws.loading': 'Loading…',

  'acct.title': 'Account settings',
  'acct.desc': 'Your own details — not tied to any one workspace',
  'acct.avatar': 'Profile picture',
  'acct.upload': 'Upload a picture',
  'acct.change': 'Change picture',
  'acct.remove': 'Remove picture',
  'acct.avatarHint':
    'PNG · JPG · WebP up to 512 KB · SVG is not accepted because it can carry scripts',
  'acct.avatarHint2':
    "You don't have to upload one — we'll use the initials from your name (Thai or English). With no name, the first two characters of your email.",
  'acct.avatarSaved': 'Profile picture updated',
  'acct.avatarRemoved': 'Picture removed · back to initials',
  'acct.avatarTooBig': 'Profile picture must be under 512 KB — try resizing it first',
  'acct.profile': 'Personal details',
  'acct.name': 'Name',
  'acct.email': 'Email',
  'acct.emailHint': 'Changing your email is not supported in this version',
  'acct.languageHint': 'Takes effect immediately and follows your account on every device',
  'acct.save': 'Save',
  'acct.saved': 'Name saved',
  'acct.changePassword': 'Change password',
  'acct.passwordWarn': 'Every signed-in device will be signed out, including this one',
  'acct.currentPassword': 'Current password',
  'acct.newPassword': 'New password',
  'acct.passwordHint': 'At least 10 characters',
  'acct.back': '← Back to my workspaces',
};

const DICTS: Record<Locale, Dict> = { th, en };

/** แทนที่ {n} ด้วยค่าที่ส่งมา — พอสำหรับตัวเลขในประโยค ไม่ต้องพึ่งไลบรารี */
export function translate(
  locale: Locale,
  key: DictKey,
  vars?: Record<string, string | number>,
): string {
  const text = DICTS[locale][key] ?? DICTS.th[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) => String(vars[name] ?? m));
}
