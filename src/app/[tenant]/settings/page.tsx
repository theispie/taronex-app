import { SettingsTabs } from '@/components/settings-tabs';
import { Card, MockNotice, PageHead } from '@/components/ui';
import { PROJECTS, tenantByCode } from '@/mock/data';

/**
 * หน้าจอ 07 · ตั้งค่าที่ทำงาน
 * เวลาทำการเป็นค่าตายตัวในเวอร์ชันนี้ แต่บอกให้ผู้ใช้รู้ว่าค่าคืออะไร
 * โควตานับเฉพาะโปรเจกต์ที่ยังเปิดอยู่ — ปิดโปรเจกต์แล้วคืนโควตาทันที
 */
export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ws = tenantByCode(tenant);
  const open = PROJECTS.filter((p) => !p.isArchived).length;

  return (
    <>
      <MockNotice />
      <PageHead title="ตั้งค่าที่ทำงาน" desc={ws?.name} />
      <SettingsTabs base={`/${tenant}`} />

      <div className="grid2">
        <Card>
          <div className="card-h">
            <b>ข้อมูลที่ทำงาน</b>
          </div>
          <div className="card-b">
            <div className="fld">
              <label className="lbl" htmlFor="wn">
                ชื่อที่ทำงาน
              </label>
              <input id="wn" className="inp" defaultValue={ws?.name} />
            </div>
            <div className="fld">
              <label className="lbl" htmlFor="wc">
                ที่อยู่ที่ทำงาน
              </label>
              <input
                id="wc"
                className="inp mn"
                defaultValue={`/app/${tenant}`}
                readOnly
                style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}
              />
              <div className="hint">ระบบสุ่มรหัสให้ · ตั้งชื่อเองได้ในเวอร์ชันถัดไป</div>
            </div>
            <button type="button" className="btn btn-pri">
              บันทึก
            </button>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>เวลาทำการ</b>
            <div className="r">
              <span className="soon-badge">แก้ไขไม่ได้ในเวอร์ชันนี้</span>
            </div>
          </div>
          <div className="card-b">
            <div className="kv">
              <span>วันทำการ</span>
              <b>จันทร์ – ศุกร์</b>
            </div>
            <div className="kv">
              <span>เวลา</span>
              <b className="mn">09:00 – 18:00</b>
            </div>
            <div className="kv">
              <span>เขตเวลา</span>
              <b>Asia/Bangkok</b>
            </div>
            <div className="kv">
              <span>วันหยุด</span>
              <b>วันหยุดราชการไทย</b>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              ค่าเหล่านี้ใช้คำนวณนาฬิกา SLA ของงานประกัน
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>โควตา</b>
          </div>
          <div className="card-b">
            <div className="kv">
              <span>โปรเจกต์ที่เปิดอยู่</span>
              <b>{open} / 10</b>
            </div>
            <div className="prog" style={{ margin: '6px 0 12px' }}>
              <i style={{ width: `${(open / 10) * 100}%` }} />
            </div>
            <div className="kv">
              <span>ที่นั่งสมาชิก</span>
              <b>5 / 15</b>
            </div>
            <div className="alert o" style={{ marginTop: 12 }}>
              <span>✓</span>
              <div>บัญชีลูกค้าไม่จำกัดทุกแผน และไม่นับโควตา</div>
            </div>
            <div className="hint" style={{ marginTop: 8 }}>
              โปรเจกต์ที่ปิดแล้วไม่นับโควตา — ปิดแล้วคืนทันที และข้อมูลยังอยู่ครบ
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-h">
            <b>แผนปัจจุบัน</b>
          </div>
          <div className="card-b">
            <div className="kv">
              <span>แผน</span>
              <b>{ws?.plan === 'team' ? 'ทีม' : 'ฟรี'}</b>
            </div>
            <div className="kv">
              <span>สถานะ</span>
              <span className={`chip ${ws?.status === 'active' ? 'st-done' : 'st-doing'}`}>
                {ws?.status === 'active' ? 'ใช้งานอยู่' : 'ทดลองใช้'}
              </span>
            </div>
            <div className="hint" style={{ marginTop: 10 }}>
              ลดแผนหรือถูกระงับก็ไม่ลบข้อมูล แค่ปิดการเข้าถึงชั่วคราว
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
