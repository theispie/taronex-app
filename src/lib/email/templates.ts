/**
 * เนื้ออีเมล
 *
 * ═══ ส่งอีเมลจริงแค่สามชนิด (สเปคหน้า 35) ═══
 * มอบหมาย · ตีกลับ · พูดถึงคุณ
 * ที่เหลือขึ้นในระบบอย่างเดียว เพราะอีเมลที่เยอะเกินจะถูกตั้งกฎให้เข้าโฟลเดอร์ทันที
 * แล้วอันที่สำคัญจริงก็จะไม่ถูกอ่านไปด้วย
 *
 * อีเมล **ธุรกรรม** (คำเชิญ · ลิงก์พอร์ทัล · ตั้งรหัสใหม่) เป็นคนละเรื่อง —
 * เป็นลิงก์ที่คนต้องได้ถึงจะใช้งานต่อได้ ไม่ใช่การแจ้งให้ทราบ
 *
 * ═══ กฎข้อ 6 กับอีเมลถึงลูกค้า ═══
 * อีเมลลิงก์พอร์ทัลส่งถึง**คนนอกองค์กร** ห้ามมีชื่อทีม ตัวเลข SLA
 * หรือรายละเอียดภายในเด็ดขาด · ในนี้จึงมีแค่ชื่อเอเจนซี่กับลิงก์
 *
 * ทุกฉบับมีทั้ง html และ text — โปรแกรมอีเมลบางตัวปิด html
 * และตัวกรองสแปมให้คะแนนอีเมลที่มีแต่ html แย่กว่า
 */

const BRAND = '#5B5BD6';

/** เปลือกกลาง — อีเมลต้องใช้ inline style ทั้งหมด เพราะ Gmail ตัด <style> ทิ้ง */
function shell(body: string, footer: string): string {
  return `<!doctype html>
<html lang="th"><body style="margin:0;padding:24px;background:#F3F4F8;font-family:'IBM Plex Sans Thai','Segoe UI',sans-serif;color:#1F2233">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #E4E6EF">
    <div style="padding:18px 24px;border-bottom:1px solid #EEF0F6;display:flex;align-items:center">
      <span style="display:inline-block;width:26px;height:26px;border-radius:7px;background:${BRAND};color:#fff;text-align:center;line-height:26px;font-weight:700;font-size:13px">T</span>
      <b style="margin-left:9px;font-size:15px">TaroNex</b>
    </div>
    <div style="padding:24px;font-size:14px;line-height:1.65">${body}</div>
    <div style="padding:14px 24px;border-top:1px solid #EEF0F6;font-size:11.5px;color:#8A8FA6">${footer}</div>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:600;font-size:14px">${label}</a></p>
<p style="font-size:11.5px;color:#8A8FA6;word-break:break-all">ถ้าปุ่มกดไม่ได้ ใช้ลิงก์นี้แทน<br>${href}</p>`;
}

export interface Mail {
  subject: string;
  html: string;
  text: string;
}

// ─────────────────────────── อีเมลธุรกรรม ───────────────────────────

export function inviteMail(o: {
  tenantName: string;
  invitedByName: string | null;
  roleLabel: string;
  url: string;
}): Mail {
  const who = o.invitedByName ? `${o.invitedByName} ` : '';
  return {
    subject: `${who}เชิญคุณเข้าร่วม ${o.tenantName} บน TaroNex`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">เชิญเข้าร่วมทีม</p>
       <p style="margin:0">${who}เชิญคุณเข้าร่วม <b>${o.tenantName}</b> ในฐานะ <b>${o.roleLabel}</b></p>
       ${button(o.url, 'รับคำเชิญ')}`,
      'ลิงก์มีอายุ 7 วัน · ถ้าคุณไม่รู้จักผู้เชิญ ไม่ต้องทำอะไร คำเชิญจะหมดอายุไปเอง',
    ),
    text: `${who}เชิญคุณเข้าร่วม ${o.tenantName} ในฐานะ ${o.roleLabel}\n\nรับคำเชิญ: ${o.url}\n\nลิงก์มีอายุ 7 วัน`,
  };
}

/**
 * ⚠ ฉบับนี้ส่งถึงคนนอกองค์กร — ห้ามมีข้อมูลภายในเด็ดขาด (กฎข้อ 6)
 * มีแค่ชื่อเอเจนซี่กับลิงก์ · ไม่มีชื่อทีม ไม่มีเลขทิกเก็ต ไม่มีตัวเลข SLA
 */
export function portalLinkMail(o: { tenantName: string; url: string }): Mail {
  return {
    subject: `ลิงก์เข้าดูงานของคุณกับ ${o.tenantName}`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">เข้าดูเรื่องที่แจ้งไว้</p>
       <p style="margin:0">กดปุ่มด้านล่างเพื่อเข้าดูสถานะงานของคุณกับ <b>${o.tenantName}</b><br>ไม่ต้องใช้รหัสผ่าน</p>
       ${button(o.url, 'เข้าดูงานของฉัน')}`,
      'ลิงก์ใช้ได้ครั้งเดียว มีอายุ 24 ชั่วโมง · ถ้าคุณไม่ได้ขอลิงก์นี้ ไม่ต้องทำอะไร',
    ),
    text: `เข้าดูสถานะงานของคุณกับ ${o.tenantName}\n\n${o.url}\n\nลิงก์ใช้ได้ครั้งเดียว มีอายุ 24 ชั่วโมง`,
  };
}

export function resetMail(o: { url: string }): Mail {
  return {
    subject: 'ตั้งรหัสผ่านใหม่ · TaroNex',
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">ตั้งรหัสผ่านใหม่</p>
       <p style="margin:0">มีคนขอตั้งรหัสผ่านใหม่ให้บัญชีนี้</p>
       ${button(o.url, 'ตั้งรหัสผ่านใหม่')}`,
      'ลิงก์มีอายุ 2 ชั่วโมง และใช้ได้ครั้งเดียว · <b>ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร</b> รหัสเดิมยังใช้ได้ตามปกติ',
    ),
    text: `มีคนขอตั้งรหัสผ่านใหม่ให้บัญชีนี้\n\n${o.url}\n\nลิงก์มีอายุ 2 ชั่วโมง ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร`,
  };
}

// ─────────────────────────── สามชนิดที่ส่งจริง ───────────────────────────

export function assignedMail(o: {
  code: string;
  title: string;
  actorName: string;
  columnName: string;
  url: string;
}): Mail {
  return {
    subject: `${o.code} ถูกส่งต่อให้คุณ · ${o.title}`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">งานถูกส่งต่อให้คุณ</p>
       <p style="margin:0"><b>${o.actorName}</b> ส่ง <b>${o.code}</b> มาที่คุณ</p>
       <p style="margin:10px 0 0;padding:12px 14px;background:#F7F8FC;border-radius:9px">
         ${o.title}<br><span style="color:#8A8FA6;font-size:12.5px">อยู่คอลัมน์ ${o.columnName}</span>
       </p>
       ${button(o.url, 'เปิดการ์ด')}`,
      'ปิดอีเมลแจ้งเตือนได้ที่หน้าตั้งค่าบัญชี',
    ),
    text: `${o.actorName} ส่ง ${o.code} มาที่คุณ\n\n${o.title}\nอยู่คอลัมน์ ${o.columnName}\n\n${o.url}`,
  };
}

export function rejectedMail(o: {
  code: string;
  title: string;
  actorName: string;
  reason: string;
  url: string;
}): Mail {
  return {
    subject: `${o.code} ถูกตีกลับ · ${o.title}`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">การ์ดถูกตีกลับ</p>
       <p style="margin:0"><b>${o.actorName}</b> ตีกลับ <b>${o.code}</b> มาที่คุณ</p>
       <p style="margin:10px 0 0;padding:12px 14px;background:#FFF7ED;border-radius:9px;border-left:3px solid #D97706">
         <b>เหตุผล</b><br>${o.reason}
       </p>
       ${button(o.url, 'เปิดการ์ด')}`,
      'ปิดอีเมลแจ้งเตือนได้ที่หน้าตั้งค่าบัญชี',
    ),
    text: `${o.actorName} ตีกลับ ${o.code} มาที่คุณ\n\n${o.title}\n\nเหตุผล: ${o.reason}\n\n${o.url}`,
  };
}

export function mentionedMail(o: {
  code: string;
  title: string;
  actorName: string;
  body: string;
  url: string;
}): Mail {
  return {
    subject: `${o.actorName} พูดถึงคุณใน ${o.code}`,
    html: shell(
      `<p style="margin:0 0 6px;font-size:17px;font-weight:600">มีคนพูดถึงคุณ</p>
       <p style="margin:0"><b>${o.actorName}</b> พูดถึงคุณใน <b>${o.code}</b> · ${o.title}</p>
       <p style="margin:10px 0 0;padding:12px 14px;background:#F7F8FC;border-radius:9px">${o.body}</p>
       ${button(o.url, 'เปิดการ์ด')}`,
      'ปิดอีเมลแจ้งเตือนได้ที่หน้าตั้งค่าบัญชี',
    ),
    text: `${o.actorName} พูดถึงคุณใน ${o.code} · ${o.title}\n\n${o.body}\n\n${o.url}`,
  };
}
