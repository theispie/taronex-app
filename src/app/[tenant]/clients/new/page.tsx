'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 28ก · เพิ่มลูกค้า
 * ตัวย่อใช้ทำไอคอนในรายการ จึงจำกัด 1–3 ตัวให้อ่านออกในกล่องเล็ก
 */
export default function NewClientPage() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/clients`, { name, code, note });
      router.push(`/${tenant}/clients`);
    } catch (e2) {
      setErr(errorText(e2));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="เพิ่มลูกค้า" desc="บัญชีลูกค้าฟรีทุกแผน ไม่นับโควตา" />
      <form onSubmit={submit}>
        <Card>
          <div className="card-b">
            {err ? (
              <div className="alert d" style={{ marginBottom: 14 }}>
                <span>✕</span>
                <div>{err}</div>
              </div>
            ) : null}
            <div className="fld">
              <span className="lbl">ชื่อลูกค้า</span>
              <input
                className="inp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="บริษัท แอคมี จำกัด"
                required
              />
            </div>
            <div className="fld">
              <span className="lbl">ตัวย่อ</span>
              <input
                className="inp mn"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="ACM"
                required
              />
              <div className="hint">1–3 ตัว ใช้ทำไอคอนในรายการ</div>
            </div>
            <div className="fld" style={{ marginBottom: 16 }}>
              <span className="lbl">บันทึกช่วยจำ</span>
              <input
                className="inp"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ไม่บังคับ"
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="btn btn-pri" disabled={busy}>
                {busy ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
              <Link href={`/${tenant}/clients`} className="btn btn-2">
                ยกเลิก
              </Link>
            </div>
          </div>
        </Card>
      </form>
    </>
  );
}
