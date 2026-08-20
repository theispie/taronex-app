/**
 * ตรวจทะเบียน endpoint กับกฎที่ห้ามละเมิดใน CLAUDE.md
 *
 * ทำไมต้องมี — กฎพวกนี้ผิดแล้วเงียบ ไม่มีอะไรพัง ไม่มีเทสต์แดง
 * จนกว่าจะมีคนทัก การตรวจจากทะเบียนจับได้ตั้งแต่ตอนวางแผน
 * ก่อนที่จะมีโค้ดให้ผิด
 *
 * นี่คือการตรวจ "แผน" ไม่ใช่ตรวจ "โค้ด" — ตอนต่อฐานข้อมูลจริง
 * ยังต้องมีเทสต์ที่ยิงข้ามที่ทำงานจริงแล้วต้องได้ 404 ตามข้อตกลงใน CLAUDE.md
 */

import { ALL_ENDPOINTS, CROSS_TENANT_ALLOWLIST, type Endpoint, endpointKey } from './registry';
import { INFRASTRUCTURE, SCREENS, usedByScreens } from './screens';

export type CheckLevel = 'pass' | 'warn' | 'fail';

export interface CheckResult {
  /** กฎข้อที่ตรวจ · 0 = ไม่ใช่กฎ แต่เป็นความสม่ำเสมอของทะเบียนเอง */
  rule: number;
  title: string;
  level: CheckLevel;
  detail: string;
  offenders: string[];
}

function result(
  rule: number,
  title: string,
  offenders: string[],
  okDetail: string,
  badDetail: string,
  level: CheckLevel = 'fail',
): CheckResult {
  return {
    rule,
    title,
    level: offenders.length === 0 ? 'pass' : level,
    detail: offenders.length === 0 ? okDetail : badDetail,
    offenders,
  };
}

/** กฎข้อ 11 — สี่ endpoint เท่านั้นที่ข้าม tenant ได้ ต้องตรงเป๊ะทั้งขาดและเกิน */
function checkCrossTenant(): CheckResult {
  const allowed = new Set<string>(CROSS_TENANT_ALLOWLIST);
  const flagged = ALL_ENDPOINTS.filter((e) => e.crossTenant).map(endpointKey);
  const extra = flagged.filter((k) => !allowed.has(k)).map((k) => `เกิน: ${k}`);
  const missing = [...allowed].filter((k) => !flagged.includes(k)).map((k) => `ขาด: ${k}`);
  return result(
    11,
    'มีสี่ endpoint เท่านั้นที่ query ข้าม tenant ได้',
    [...extra, ...missing],
    `ตรงกับรายชื่อครบ ${allowed.size} รายการ`,
    'รายชื่อไม่ตรงกับกฎข้อ 11',
  );
}

/** กฎข้อ 4 — คอลัมน์ขยับได้ทางเดียว */
function checkTransitionGate(): CheckResult {
  const offenders: string[] = [];
  const transition = ALL_ENDPOINTS.find((e) => e.path === '/tasks/:id/transition');
  if (!transition) offenders.push('ขาด: POST /tasks/:id/transition');

  const patch = ALL_ENDPOINTS.find((e) => e.method === 'PATCH' && e.path === '/tasks/:id');
  if (!patch) offenders.push('ขาด: PATCH /tasks/:id');
  else if (!patch.rules?.includes(4)) offenders.push('PATCH /tasks/:id ไม่ได้กำกับกฎข้อ 4');

  // endpoint อื่นที่พูดถึงคอลัมน์ในเชิงเปลี่ยนค่า ต้องไม่มีนอกจากสองรายการนี้
  const suspects = ALL_ENDPOINTS.filter(
    (e) =>
      e.method !== 'GET' &&
      e.path !== '/tasks/:id/transition' &&
      e.path !== '/tasks/:id' &&
      e.summary.includes('column_key'),
  ).map(endpointKey);
  offenders.push(...suspects.map((k) => `เขียน column_key นอกประตู: ${k}`));

  return result(
    4,
    'tasks.column_key เปลี่ยนได้ทาง POST /tasks/:id/transition เท่านั้น',
    offenders,
    'มีประตูเดียว และ PATCH ปฏิเสธ column_key ด้วย 400',
    'ประตูของการ์ดไม่ได้ปิดสนิท',
  );
}

/**
 * สถานะที่ลูกค้าเห็นต้องมีประตูเดียว และต้องมาจากคนกดเสมอ
 * ใช้หลักเดียวกับกฎข้อ 4 — ถ้ามีหลายทางเข้า วันหนึ่งจะมีทางที่ลืมเขียน task_events
 */
function checkPortalStageGate(): CheckResult {
  const offenders: string[] = [];
  const gate = ALL_ENDPOINTS.find((e) => e.path === '/tasks/:id/portal-stage');
  if (!gate) offenders.push('ขาด: POST /tasks/:id/portal-stage');
  else if (!gate.rules?.includes(5))
    offenders.push('ประตูสถานะพอร์ทัลไม่ได้กำกับกฎข้อ 5 (ต้องเขียน task_events)');

  const patch = ALL_ENDPOINTS.find((e) => e.method === 'PATCH' && e.path === '/tasks/:id');
  if (patch && !patch.summary.includes('portal_stage')) {
    offenders.push('PATCH /tasks/:id ไม่ได้ประกาศว่าปฏิเสธ portal_stage');
  }

  const others = ALL_ENDPOINTS.filter(
    (e) =>
      e.method !== 'GET' &&
      e.path !== '/tasks/:id/portal-stage' &&
      e.path !== '/tasks/:id' &&
      e.summary.includes('portal_stage'),
  ).map((e) => `เขียน portal_stage นอกประตู: ${endpointKey(e)}`);
  offenders.push(...others);

  return result(
    0,
    'สถานะที่ลูกค้าเห็นเปลี่ยนได้ทางเดียว และต้องมีคนกดเสมอ',
    offenders,
    'มีประตูเดียว · ไม่มีเส้นทางไหนตั้งสถานะพอร์ทัลอัตโนมัติ',
    'สถานะฝั่งลูกค้ามีทางเข้ามากกว่าหนึ่งทาง',
  );
}

/** กฎข้อ 6 — พอร์ทัลแยกโดยสิ้นเชิง */
function checkPortalIsolation(): CheckResult {
  const offenders = ALL_ENDPOINTS.filter(
    (e) => e.path.startsWith('/portal/') && (e.scope !== 'portal' || !e.rules?.includes(6)),
  ).map((e) => `${endpointKey(e)} · scope=${e.scope}`);

  const leaked = ALL_ENDPOINTS.filter(
    (e) => e.scope === 'portal' && !e.path.startsWith('/portal/'),
  ).map((e) => `อยู่นอก /portal: ${endpointKey(e)}`);

  return result(
    6,
    'พอร์ทัลใช้ serializer และการยืนยันตัวตนแยกโดยสิ้นเชิง',
    [...offenders, ...leaked],
    'ทุกเส้นทางพอร์ทัลอยู่ใต้ /portal และกำกับกฎข้อ 6',
    'มีเส้นทางพอร์ทัลที่ยังไม่ได้แยก',
  );
}

/** กฎข้อ 5 — task_events เขียนอย่างเดียว */
function checkEventsAppendOnly(): CheckResult {
  const offenders = ALL_ENDPOINTS.filter(
    (e) => e.path.includes('/events') && e.method !== 'GET' && e.method !== 'POST',
  ).map(endpointKey);
  return result(
    5,
    'task_events เขียนอย่างเดียว ไม่มีทางแก้หรือลบผ่าน API',
    offenders,
    'ไม่มี PATCH/PUT/DELETE บนเส้นทางเหตุการณ์',
    'มีเส้นทางที่แก้หรือลบเหตุการณ์ได้',
  );
}

/** กฎข้อ 10 — ทุก endpoint ในขอบเขต tenant ต้องบอกว่าต้องการสิทธิ์ระดับไหน */
function checkAccessDeclared(): CheckResult {
  const offenders = ALL_ENDPOINTS.filter((e) => e.scope === 'tenant' && !e.access).map(endpointKey);
  return result(
    10,
    'ทุก endpoint ในขอบเขต tenant ประกาศสิทธิ์ที่ resolveAccess ต้องคืน',
    offenders,
    'ประกาศครบทุกรายการ',
    'มี endpoint ที่ยังไม่ได้ประกาศสิทธิ์',
  );
}

/** กฎข้อ 7 — ไม่มี DELETE บนเส้นทางที่เกี่ยวกับการเงิน */
function checkNoDestructiveBilling(): CheckResult {
  const billingWords = ['/billing', '/plan', '/subscription', '/quota'];
  const offenders = ALL_ENDPOINTS.filter(
    (e) => e.method === 'DELETE' && billingWords.some((w) => e.path.includes(w)),
  ).map(endpointKey);
  return result(
    7,
    'ไม่มี DELETE บนข้อมูลผู้ใช้ในเส้นทางที่เกี่ยวกับการเงิน',
    offenders,
    'เกินโควตาและถูกระงับ ปิดการเข้าถึงเท่านั้น',
    'มีเส้นทางการเงินที่ลบข้อมูลได้',
  );
}

/** ความสม่ำเสมอของทะเบียนเอง — ไม่ใช่กฎ แต่ผิดแล้วทะเบียนใช้ไม่ได้ */
function checkRegistryShape(): CheckResult {
  const seen = new Set<string>();
  const offenders: string[] = [];
  for (const e of ALL_ENDPOINTS) {
    const k = endpointKey(e);
    if (seen.has(k)) offenders.push(`ซ้ำ: ${k}`);
    seen.add(k);
    if (!e.path.startsWith('/')) offenders.push(`ไม่ขึ้นต้นด้วย /: ${k}`);
    if (e.path.length > 1 && e.path.endsWith('/')) offenders.push(`ลงท้ายด้วย /: ${k}`);
    if (!e.summary.trim()) offenders.push(`ไม่มีคำอธิบาย: ${k}`);
  }
  return result(
    0,
    'ทะเบียนไม่มีเส้นทางซ้ำ และทุกแถวมีคำอธิบาย',
    offenders,
    `ตรวจแล้ว ${ALL_ENDPOINTS.length} รายการ`,
    'ทะเบียนมีแถวที่ใช้ไม่ได้',
  );
}

/** สิ่งที่ยังไม่ได้ตัดสิน — ไม่ใช่ความผิด แต่ห้ามลืม */
function checkOpenQuestions(): CheckResult {
  const offenders = ALL_ENDPOINTS.filter((e) => e.note?.includes('ยังไม่ตัดสิน')).map(
    (e) => `${endpointKey(e)} — ${e.note ?? ''}`,
  );
  return result(
    0,
    'ข้อที่ยังไม่ได้ตัดสิน ต้องถามก่อนลงมือ',
    offenders,
    'ไม่มีข้อค้าง',
    'มีข้อที่ต้องถามก่อนเริ่มหมุดหมายที่เกี่ยวข้อง',
    'warn',
  );
}

/** ทุกหน้าจอต้องมี endpoint รองรับ ไม่งั้นหน้านั้นทำงานจริงไม่ได้ */
function checkScreensCovered(): CheckResult {
  const known = new Set(ALL_ENDPOINTS.map(endpointKey));
  const offenders: string[] = [];
  for (const sc of SCREENS) {
    if (sc.uses.length === 0) {
      offenders.push(`หน้า ${sc.no} ${sc.name} — ไม่ได้ผูกกับ endpoint ไหนเลย`);
      continue;
    }
    for (const u of sc.uses) {
      if (!known.has(u)) offenders.push(`หน้า ${sc.no} ${sc.name} → ไม่มีในทะเบียน: ${u}`);
    }
  }
  return result(
    0,
    `ทั้ง ${SCREENS.length} หน้าจอมี endpoint รองรับครบ`,
    offenders,
    `ไล่ครบทุกหน้าแล้ว`,
    'มีหน้าจอที่ยังไม่มี endpoint รองรับ',
  );
}

/** endpoint ที่ไม่มีหน้าจอไหนเรียก = เขียนเผื่อไว้เกินจำเป็น */
function checkNoOrphanEndpoints(): CheckResult {
  const used = usedByScreens();
  const offenders = ALL_ENDPOINTS.map(endpointKey)
    .filter((k) => !used.has(k))
    .map((k) => `ไม่มีหน้าจอไหนเรียก: ${k}`);
  return result(
    0,
    'ไม่มี endpoint ที่เขียนทิ้งไว้โดยไม่มีใครเรียก',
    offenders,
    `ทุกเส้นทางมีหน้าจอปลายทาง หรืออยู่ในรายการโครงสร้างพื้นฐาน ${INFRASTRUCTURE.length} รายการ`,
    'มีเส้นทางที่ไม่มีหน้าจอไหนใช้ — ตัดทิ้งหรือผูกกับหน้าจอ',
    'warn',
  );
}

export function runAudit(): CheckResult[] {
  return [
    checkCrossTenant(),
    checkTransitionGate(),
    checkPortalIsolation(),
    checkPortalStageGate(),
    checkEventsAppendOnly(),
    checkAccessDeclared(),
    checkNoDestructiveBilling(),
    checkRegistryShape(),
    checkScreensCovered(),
    checkNoOrphanEndpoints(),
    checkOpenQuestions(),
  ];
}

export function auditSummary(results: CheckResult[]): { pass: number; warn: number; fail: number } {
  return {
    pass: results.filter((r) => r.level === 'pass').length,
    warn: results.filter((r) => r.level === 'warn').length,
    fail: results.filter((r) => r.level === 'fail').length,
  };
}

/** endpoint ที่มีหมายเหตุว่าต่างจากเอกสารสถาปัตยกรรมเดิม */
export function driftFromSpec(): Endpoint[] {
  return ALL_ENDPOINTS.filter((e) => e.note && !e.note.includes('ยังไม่ตัดสิน'));
}
