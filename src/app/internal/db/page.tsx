import { readLiveDb } from '@/lib/db/live';
import { readSchema } from '@/lib/db/schema-map';
import { TableList } from './table-list';

/**
 * หน้าภายใน · ผังฐานข้อมูล
 *
 * ═══ แสดงสองด้านคู่กันเสมอ ═══
 * **ผังในโค้ด** (`src/db/schema.ts` ผ่าน Drizzle) = สิ่งที่ตั้งใจให้เป็น
 * **ฐานจริง** (pg_catalog) = สิ่งที่เป็นอยู่ตอนนี้
 *
 * สองอย่างนี้ไม่ตรงกันได้ — migration ยังไม่ได้รัน · `db/rls.sql` ยังไม่ได้ลง ·
 * มีคนแก้ที่ฐานตรงๆ · หรือชี้ไปคนละฐาน
 * ถ้าแสดงแค่ด้านเดียว คนอ่านจะเห็นความตั้งใจแล้วนึกว่าของจริงเป็นแบบนั้น
 * ซึ่งเป็นวิธีที่ทำให้ RLS หลุดโดยไม่มีใครรู้
 *
 * ผังไม่ได้พิมพ์ซ้ำ อ่านจากของจริงตอนรัน จึงไม่มีทางเก่า
 * สิ่งเดียวที่พิมพ์มือคือ "ทำไม" ซึ่งมีเทสต์กันไม่ให้ชี้ไปที่คอลัมน์ที่ไม่มีแล้ว
 */
export const dynamic = 'force-dynamic';

export default async function InternalDbPage() {
  const tables = readSchema();
  const live = await readLiveDb();
  const liveByName = Object.fromEntries(live.tables.map((t) => [t.name, t]));

  const expectRls = tables.filter((t) => t.hasTenantId);
  const forced = expectRls.filter((t) => liveByName[t.name]?.rlsForced).length;
  const totalColumns = tables.reduce((n, t) => n + t.columns.length, 0);
  const rlsOk = live.ok && forced === expectRls.length;
  const roleOk = live.appRole && !live.appRole.superuser && !live.appRole.bypassRls;

  /** ตารางที่อยู่ในโค้ดแต่ไม่มีในฐาน (หรือกลับกัน) — สัญญาณว่า migration ไม่ตรง */
  const inCode = new Set(tables.map((t) => t.name));
  const inDb = new Set(live.tables.map((t) => t.name).filter((n) => !n.startsWith('__')));
  const missingInDb = [...inCode].filter((n) => !inDb.has(n));
  const extraInDb = [...inDb].filter((n) => !inCode.has(n));

  return (
    <div className="ipage">
      <div className="ph">
        <div>
          <h1>ฐานข้อมูล</h1>
          <div className="d">
            ตารางทั้งหมด ฟิลด์ ชนิดข้อมูล และกุญแจนอก · ผังอ่านจาก{' '}
            <span className="mn">src/db/schema.ts</span> ตอนรัน จึงตรงกับของจริงเสมอ
          </div>
        </div>
      </div>

      <div className="alert i" style={{ marginBottom: 16 }}>
        <span>ℹ</span>
        <div>
          <b>หน้านี้ยังเปิดโล่ง</b> — ในนี้มีแต่<b>รูปร่าง</b>ของฐานข้อมูล ไม่มีข้อมูลของผู้ใช้
          (จำนวนแถวเป็นค่าประมาณจากตัววางแผนคำสั่ง ไม่ได้อ่านเนื้อในสักแถว) แต่ตอนนี้เครื่องมีฐานข้อมูลจริงแล้ว{' '}
          <b>ก่อนรับลูกค้าจริงต้องปิด /internal ทั้งชุด</b> ด้วย basic auth ที่ nginx หรือผูกกับเซสชันของเจ้าของที่ทำงาน
        </div>
      </div>

      {/* ── ตัวเลขรวม ── */}
      <div className="istat">
        <div className="c">
          <div className="n">{tables.length}</div>
          <div className="l">ตาราง</div>
        </div>
        <div className="c">
          <div className="n">{totalColumns}</div>
          <div className="l">ฟิลด์รวม</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: rlsOk ? 'var(--ok)' : 'var(--danger)' }}>
            {forced}/{expectRls.length}
          </div>
          <div className="l">RLS + FORCE</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: roleOk ? 'var(--ok)' : 'var(--danger)' }}>
            {roleOk ? '✓' : '✕'}
          </div>
          <div className="l">role app ข้าม RLS ไม่ได้</div>
        </div>
        <div className="c">
          <div className="n">{live.migrations ?? '—'}</div>
          <div className="l">
            {live.migrations === null ? 'migration · อ่านไม่ได้' : 'migration ที่ลงแล้ว'}
          </div>
        </div>
      </div>

      {live.error ? (
        <div className="alert e" style={{ marginBottom: 16 }}>
          <span>✕</span>
          <div>
            <b>ต่อฐานข้อมูลไม่ได้</b> — {live.error}
            <br />
            ข้างล่างเป็นผังจากโค้ดเท่านั้น ยังไม่ได้เทียบกับของจริง
          </div>
        </div>
      ) : null}

      {missingInDb.length > 0 || extraInDb.length > 0 ? (
        <div className="alert w" style={{ marginBottom: 16 }}>
          <span>⚠</span>
          <div>
            <b>ผังในโค้ดกับฐานจริงไม่ตรงกัน</b>
            {missingInDb.length > 0 ? (
              <div>
                มีในโค้ดแต่ยังไม่มีในฐาน: <span className="mn">{missingInDb.join(' · ')}</span> —
                น่าจะยังไม่ได้รัน <span className="mn">pnpm db:migrate</span>
              </div>
            ) : null}
            {extraInDb.length > 0 ? (
              <div>
                มีในฐานแต่ไม่มีในโค้ด: <span className="mn">{extraInDb.join(' · ')}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid2" style={{ marginBottom: 16 }}>
        {/* ── ฐานที่ต่ออยู่จริง ── */}
        <div className="card">
          <div className="card-h">
            <b>ฐานที่ต่ออยู่ตอนนี้</b>
            <div className="r">
              <span className={`chip ${live.ok ? 'st-done' : 'st-blocked'}`}>
                {live.ok ? 'ต่อได้' : 'ต่อไม่ได้'}
              </span>
            </div>
          </div>
          <div className="card-b">
            <div className="kv">
              <span>ชื่อฐาน</span>
              <b className="mn">{live.database}</b>
            </div>
            <div className="kv">
              <span>PostgreSQL</span>
              <b className="mn">{live.version}</b>
            </div>
            <div className="kv">
              <span>ขนาด</span>
              <b className="mn">{live.sizePretty}</b>
            </div>
            <div className="kv">
              <span>role ที่แอปใช้</span>
              <b className="mn">
                {live.appRole
                  ? `app · superuser=${live.appRole.superuser ? 'ใช่' : 'ไม่'} · bypassrls=${live.appRole.bypassRls ? 'ใช่' : 'ไม่'}`
                  : 'ไม่พบ role app'}
              </b>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              แอปต่อด้วย role <span className="mn">app</span> ที่เป็น NOSUPERUSER NOBYPASSRLS และ
              <b>ไม่ใช่เจ้าของตาราง</b> — ถ้าสองค่านี้กลายเป็น “ใช่” เมื่อไร RLS ทั้งระบบจะไม่มีผลทันที
            </div>
            {live.migrations === null ? (
              <div className="hint" style={{ marginTop: 10 }}>
                จำนวน migration อ่านไม่ได้เพราะ role <span className="mn">app</span> ไม่มีสิทธิ์อ่าน schema{' '}
                <span className="mn">drizzle</span> — <b>ถูกแล้ว</b> ตารางนั้นเป็นของเจ้าของฐาน ไม่ใช่ของแอป
                · ดูจำนวนจริงได้ด้วย <span className="mn">pnpm db:migrate</span>
              </div>
            ) : null}
            <div className="hint" style={{ marginTop: 8 }}>
              เทสต์รันกับฐานคนละใบ (<span className="mn">taronex_test</span>) เพราะเทสต์สั่ง TRUNCATE
              ทุกตาราง · ตัวกันอยู่ที่ <span className="mn">src/test/db.ts</span>
            </div>
          </div>
        </div>

        {/* ── trigger ── */}
        <div className="card">
          <div className="card-h">
            <b>trigger ที่บังคับกติกาอยู่</b>
            <div className="r">
              <span className="sub">{live.triggers.length} ตัว</span>
            </div>
          </div>
          <div className="card-b">
            <p className="hint" style={{ marginBottom: 10 }}>
              กติกาที่สำคัญที่สุดบังคับที่<b>ชั้นฐานข้อมูล</b> ไม่ใช่แค่โค้ดฝั่งแอป — ต่อให้ยิง SQL ตรงเข้ามาก็ยังถูกปฏิเสธ
            </p>
            {live.triggers.length === 0 ? (
              <div className="empty">ยังไม่มี trigger — ยังไม่ได้ลง db/rls.sql</div>
            ) : (
              live.triggers.map((t) => (
                <div className="kv" key={t}>
                  <span className="mn">{t}</span>
                  <span className="sub" style={{ fontSize: 11.5 }}>
                    {t === 'guard_task_column'
                      ? 'ย้ายคอลัมน์ได้ทาง /transition เท่านั้น (กฎข้อ 4)'
                      : t === 'guard_portal_stage'
                        ? 'สถานะฝั่งลูกค้าเปลี่ยนได้ทาง /portal-stage เท่านั้น · ไม่มี auto'
                        : t === 'guard_last_owner'
                          ? 'ที่ทำงานต้องมีเจ้าของอย่างน้อยหนึ่งคนเสมอ (กฎข้อ 12)'
                          : t === 'guard_column_exists'
                            ? 'การ์ดต้องอยู่ในคอลัมน์ที่มีอยู่จริงบนบอร์ด'
                            : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── ตารางทั้งหมด ── */}
      <div className="ph" style={{ marginTop: 22 }}>
        <div>
          <h1 style={{ fontSize: 17 }}>ตารางทั้งหมด</h1>
          <div className="d">
            แหล่งความจริงอยู่ที่ <span className="mn">src/db/schema.ts</span> · นโยบาย RLS กับ trigger อยู่ที่{' '}
            <span className="mn">db/rls.sql</span>
          </div>
        </div>
      </div>

      <TableList tables={tables} live={liveByName} />
    </div>
  );
}
