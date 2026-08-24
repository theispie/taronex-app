'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiCallError, api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 30 · พอร์ทัล — หน้าแรก
 *
 * แยกเป็นสองกลุ่มพอ: กำลังดำเนินการ กับ แก้ไขแล้ว
 * ลูกค้าไม่ต้องรู้จักคอลัมน์ทั้งสี่ของทีม — ป้ายที่เห็นมาจาก `portal_stage` ที่คนกดเอง
 * ใช้คำว่า "แจ้งปัญหา" ไม่ใช่ "สร้างทิกเก็ต" · "กำลังแก้ไข" ไม่ใช่ "กำลังทำ"
 *
 * เรื่องที่ยังไม่มีใครกดรับ ขึ้นว่า "ส่งเรื่องแล้ว รอเจ้าหน้าที่รับเรื่อง"
 * ไม่ใช่ป้ายว่างหรือคำที่แปลจากบอร์ด — ตรงไปตรงมากว่า และไม่มี auto
 */
interface Issue {
  code: string;
  title: string;
  stageLabel: string;
  isResolved: boolean;
  reportedOn: string;
}
interface Data {
  open: Issue[];
  closed: Issue[];
  me: { name: string; clientName: string; canReport: boolean };
  projects: { id: string; key: string; name: string }[];
}

function thaiDate(iso: string): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PortalHome() {
  const slug = String(useParams().slug ?? '');
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<Data>(`/portal/${slug}/issues`));
    } catch (e) {
      // ยังไม่ได้เข้าใช้งาน → ไปหน้าขอลิงก์ ไม่ใช่โชว์ข้อความผิดพลาด
      if (e instanceof ApiCallError && e.code === 'E_UNAUTHENTICATED') {
        router.replace(`/portal/${slug}/login`);
        return;
      }
      setErr(errorText(e));
    }
  }, [slug, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = (list: Issue[]) =>
    list.map((x) => (
      <Link key={x.code} href={`/portal/${slug}/i/${x.code}`} className="pw-row">
        <span className="mn pw-code">{x.code}</span>
        <span className="pw-title">{x.title}</span>
        <span
          className={x.isResolved ? 'chip st-done' : 'chip'}
          style={x.isResolved ? undefined : { background: 'var(--ws-50)', color: 'var(--ws-700)' }}
        >
          {x.stageLabel}
        </span>
        <span className="sub mn">{thaiDate(x.reportedOn)}</span>
      </Link>
    ));

  return (
    <>
      <div className="pw-head">
        <div>
          <h1>เรื่องที่แจ้งไว้</h1>
          <p className="sub">
            {data ? `${data.me.name} · ${data.me.clientName}` : 'ติดตามสถานะได้ที่นี่ ไม่ต้องโทรถาม'}
          </p>
        </div>
        {data?.me.canReport ? (
          <Link href={`/portal/${slug}/new`} className="btn btn-ws btn-lg">
            ＋ แจ้งปัญหา
          </Link>
        ) : null}
      </div>

      {err ? <div className="alert e">{err}</div> : null}
      {data === null && !err ? <div className="pw-card">กำลังโหลด…</div> : null}

      {data ? (
        <>
          <h2 className="pw-h2">กำลังดำเนินการ</h2>
          <div className="pw-card mb">
            {data.open.length ? rows(data.open) : <div className="empty">ไม่มีเรื่องที่กำลังดำเนินการ</div>}
          </div>

          <h2 className="pw-h2">แก้ไขแล้ว</h2>
          <div className="pw-card">
            {data.closed.length ? rows(data.closed) : <div className="empty">ยังไม่มีเรื่องที่ปิดแล้ว</div>}
          </div>
        </>
      ) : null}
    </>
  );
}
