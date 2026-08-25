import { auditSummary, driftFromSpec, runAudit } from '@/lib/api/audit';
import { API_BASE, countByMilestone, countByStatus, endpointKey, GROUPS } from '@/lib/api/registry';
import { SCREENS } from '@/lib/api/screens';
import { EndpointTable } from './endpoint-table';
import { HealthProbe } from './health-probe';

/**
 * หน้าภายใน · ผังและสถานะของ API ทั้งระบบ
 *
 * ทำไมมีหน้านี้ — ทะเบียน endpoint อยู่ในโค้ดแล้ว (src/lib/api/registry.ts)
 * แต่ถ้าไม่มีที่ให้ดู มันจะไม่ถูกอ่านและจะเก่าเงียบๆ หน้านี้ทำให้ทะเบียน
 * ถูกใช้จริงทุกครั้งที่เปิดดู และผลตรวจกฎขึ้นทันทีที่มีคนวางแผนผิด
 *
 * ตัวเลข "ใช้ได้แล้ว / ยังไม่ทำ" มาจากทะเบียน ไม่ใช่จากการยิงจริง
 * ส่วนที่ยิงจริงคือกล่องสถานะเครื่องด้านบน ซึ่งเรียก /meta/health ทุก 20 วินาที
 */
export const dynamic = 'force-dynamic';

const LEVEL_ICON = { pass: '✓', warn: '!', fail: '✕' } as const;

export default function InternalApiPage() {
  const total = countByStatus();
  const milestones = countByMilestone();
  const checks = runAudit();
  const sum = auditSummary(checks);
  const drift = driftFromSpec();

  return (
    <div className="ipage">
      <div className="ph">
        <div>
          <h1>API ของระบบ</h1>
          <div className="d">
            ทะเบียนเส้นทางทั้งหมด สถานะการทำจริง และผลตรวจกฎ · ทุกเส้นทางอยู่ใต้{' '}
            <span className="mn">{API_BASE}</span>
          </div>
        </div>
      </div>

      <div className="alert i" style={{ marginBottom: 16 }}>
        <span>ℹ</span>
        <div>
          <b>หน้านี้ยังเปิดโล่ง</b> — ในนี้ไม่มีข้อมูลผู้ใช้ มีแต่รูปร่างของ API แต่ตอนนี้เครื่องมีฐานข้อมูลจริงแล้ว
          ก่อนรับลูกค้าจริงต้องปิด <span className="mn">/internal</span> ทั้งชุดด้วย basic auth ที่ nginx
          หรือผูกกับเซสชันของเจ้าของที่ทำงาน
          <br />
          ผังฐานข้อมูลอยู่ที่{' '}
          <a className="auth-link" href="/internal/db">
            /internal/db
          </a>
        </div>
      </div>

      {/* ── ยิงจริง ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <b>สถานะเครื่อง</b>
          <div className="r">
            <span className="chip">ยิงจริงทุก 20 วินาที</span>
          </div>
        </div>
        <div className="card-b">
          <HealthProbe />
        </div>
      </div>

      {/* ── ความคืบหน้า ── */}
      <div className="istat">
        <div className="c">
          <div className="n">{total.total}</div>
          <div className="l">เส้นทางทั้งหมด</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: 'var(--ok)' }}>
            {total.live}
          </div>
          <div className="l">ใช้ได้แล้ว</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: 'var(--warn)' }}>
            {total.partial}
          </div>
          <div className="l">ทำบางส่วน</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: 'var(--muted)' }}>
            {total.planned}
          </div>
          <div className="l">ยังไม่ทำ</div>
        </div>
        <div className="c">
          <div className="n" style={{ color: sum.fail > 0 ? 'var(--danger)' : 'var(--ok)' }}>
            {sum.pass}/{checks.length}
          </div>
          <div className="l">ผลตรวจกฎที่ผ่าน</div>
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 16 }}>
        {/* ── ผลตรวจกฎ ── */}
        <div className="card">
          <div className="card-h">
            <b>ตรวจกฎจากทะเบียน</b>
            <div className="r">
              <span className={`chip ${sum.fail > 0 ? 'st-blocked' : 'st-done'}`}>
                {sum.fail > 0 ? `ตก ${sum.fail}` : 'ผ่านหมด'}
              </span>
            </div>
          </div>
          <div className="card-b">
            {checks.map((c) => (
              <div className={`ichk ${c.level}`} key={`${c.rule}-${c.title}`}>
                <div className="i">{LEVEL_ICON[c.level]}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="t">
                    {c.rule > 0 ? <span className="mn">กฎ {c.rule} · </span> : null}
                    {c.title}
                  </div>
                  <div className="d">{c.detail}</div>
                  {c.offenders.map((o) => (
                    <div className="o" key={o}>
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="hint" style={{ marginTop: 10 }}>
              นี่คือการตรวจแผน ไม่ใช่ตรวจโค้ด — ตอนต่อฐานข้อมูลยังต้องมีเทสต์ที่ยิงข้ามที่ทำงานจริง แล้วต้องได้ 404
            </div>
          </div>
        </div>

        {/* ── หมุดหมาย ── */}
        <div className="card">
          <div className="card-h">
            <b>แบ่งตามหมุดหมาย</b>
          </div>
          <div className="card-b">
            {milestones.map((m) => {
              const donePct = (m.count.live / m.count.total) * 100;
              const partPct = (m.count.partial / m.count.total) * 100;
              return (
                <div key={m.milestone} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4, alignItems: 'baseline' }}>
                    <b style={{ fontSize: 12.5, minWidth: 40 }}>{m.milestone}</b>
                    <span className="sub" style={{ marginLeft: 'auto' }}>
                      {m.count.live}/{m.count.total}
                    </span>
                  </div>
                  <div className="iprog">
                    <i style={{ width: `${donePct}%`, background: 'var(--ok)' }} />
                    <i style={{ width: `${partPct}%`, background: 'var(--warn)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── ต่างจากเอกสารเดิม ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <b>ต่างจาก taronex-architecture.html</b>
          <div className="r">
            <span className="chip st-doing">{drift.length} รายการ</span>
          </div>
        </div>
        <div className="card-b">
          <p className="sub" style={{ marginBottom: 10 }}>
            เอกสารสถาปัตยกรรมยังไม่ได้แก้ตามการตัดสินใจใหม่ ทะเบียนนี้ยึดของใหม่ไว้แล้ว
            รายการข้างล่างคือจุดที่ต้องกลับไปแก้เอกสารตอน M1
          </p>
          {drift.map((e) => (
            <div className="kv" key={endpointKey(e)} style={{ alignItems: 'flex-start' }}>
              <span className="mn" style={{ minWidth: 210 }}>
                {endpointKey(e)}
              </span>
              <span style={{ fontSize: 12.5 }}>{e.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ใช้ยังไง ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <b>เอาไปใช้ต่อยังไง</b>
          <div className="r">
            <span className="chip st-done">OpenAPI 3.1</span>
          </div>
        </div>
        <div className="card-b">
          <p className="sub" style={{ marginBottom: 12 }}>
            หน้านี้ไม่ได้มาแทน Postman หรือ Swagger — มันเป็น<b>ต้นทาง</b>ของทั้งสองอย่าง ทะเบียนใน{' '}
            <span className="mn">registry.ts</span> ถูกแปลงเป็นสเปค OpenAPI สดทุกครั้งที่เรียก
            เครื่องมือที่คุณถนัดจึงดึงไปใช้ได้เลย และไม่มีวันเก่ากว่าโค้ด
          </p>
          <div className="kv">
            <span style={{ minWidth: 150 }}>นำเข้า Postman</span>
            <span className="mn">Import → Link → {API_BASE}/meta/openapi</span>
          </div>
          <div className="kv">
            <span style={{ minWidth: 150 }}>Swagger UI</span>
            <span className="mn">ชี้ url มาที่ {API_BASE}/meta/openapi (ไม่ต้องลงอะไรในเครื่อง)</span>
          </div>
          <div className="kv">
            <span style={{ minWidth: 150 }}>ดูจากบรรทัดคำสั่ง</span>
            <span className="mn">curl -s .../meta/endpoints | python3 -m json.tool</span>
          </div>
          <div className="hint" style={{ marginTop: 10 }}>
            เหตุผลที่ไม่ติดตั้ง Swagger UI ลงในแอป — เครื่องมี RAM 512 MB และสเปคที่เขียนแยกจากโค้ดจะไม่ตรงกันในที่สุด
            สร้างจากทะเบียนแล้วเก่าไม่ได้
          </div>
        </div>
      </div>

      {/* ── หน้าจอครบไหม ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <b>หน้าจอ {SCREENS.length} หน้า ↔ endpoint ที่ต้องใช้</b>
          <div className="r">
            <span className="chip">{SCREENS.reduce((n, sc) => n + sc.uses.length, 0)} เส้นเชื่อม</span>
          </div>
        </div>
        <div className="card-b" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <p className="sub" style={{ marginBottom: 10 }}>
            ไล่จากหน้าจอเข้าหา endpoint — ทางเดียวที่จะรู้ว่าเอกสารสถาปัตยกรรมตกอะไรไป
            รอบนี้เจอสามจุดที่ไม่มีในเอกสารเดิม ทำเครื่องหมาย ※ ไว้ในทะเบียนข้างล่างแล้ว
          </p>
          {SCREENS.map((sc) => (
            <div className="kv" key={sc.no} style={{ alignItems: 'flex-start' }}>
              <span style={{ minWidth: 210 }}>
                <b className="mn">{sc.no}</b> {sc.name}
              </span>
              <span className="mn" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {sc.uses.join(' · ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ทะเบียนทั้งชุด ── */}
      <div className="ph" style={{ marginTop: 22 }}>
        <div>
          <h1 style={{ fontSize: 17 }}>ทะเบียนทั้งชุด</h1>
          <div className="d">
            แหล่งความจริงอยู่ที่ <span className="mn">src/lib/api/registry.ts</span> · ดึงเป็น JSON ได้ที่{' '}
            <span className="mn">{API_BASE}/meta/endpoints</span>
          </div>
        </div>
      </div>
      <EndpointTable groups={GROUPS} />
    </div>
  );
}
