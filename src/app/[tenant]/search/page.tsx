'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { TaskRow, type TaskRowData } from '@/components/task-row';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 22 · ค้นหาทั่วที่ทำงาน
 *
 * คำค้นอยู่ใน URL — ส่งลิงก์ผลค้นหาให้กันได้ และปุ่มย้อนกลับทำงานถูก
 *
 * ค้นภาษาไทยที่ไม่มีเว้นวรรคได้ เพราะฝั่งเซิร์ฟเวอร์ใช้ ILIKE ไม่ใช่ full-text
 * ตัวตัดคำของ Postgres มองประโยคไทยทั้งประโยคเป็นคำเดียว
 */
interface Result {
  tasks: TaskRowData[];
  matchedByCode: boolean;
}

function SearchInner() {
  const tenant = String(useParams().tenant ?? '');
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const [term, setTerm] = useState(q);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTerm(q);
    if (!q.trim()) {
      setResult(null);
      return;
    }
    api
      .get<Result>(`/t/${tenant}/search?q=${encodeURIComponent(q)}`)
      .then(setResult)
      .catch((e) => setErr(errorText(e)));
  }, [tenant, q]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(term.trim() ? `?q=${encodeURIComponent(term.trim())}` : '?');
  }

  return (
    <>
      <PageHead
        title="ค้นหา"
        desc={result ? `พบ ${result.tasks.length} ใบ` : 'ค้นข้ามทุกโปรเจกต์ · ใส่รหัสการ์ดก็ได้'}
      />

      <form onSubmit={submit} className="ifilter" style={{ marginBottom: 14 }}>
        <input
          className="inp"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="คำค้น หรือรหัสการ์ด เช่น ACM-138"
        />
        <button type="submit" className="btn btn-pri btn-sm">
          ค้นหา
        </button>
      </form>

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      {result ? (
        <Card>
          <div className="card-b">
            {result.matchedByCode ? (
              <div className="alert i" style={{ marginBottom: 10 }}>
                <span>ℹ</span>
                <div>ตรงกับรหัสการ์ดพอดี</div>
              </div>
            ) : null}
            {result.tasks.length === 0 ? (
              <div className="empty">ไม่พบการ์ดที่ตรงกับ “{q}”</div>
            ) : (
              result.tasks.map((t) => (
                <div className="row" key={t.id}>
                  <span className="sub mn" style={{ minWidth: 40 }}>
                    {t.projectKey}
                  </span>
                  <TaskRow task={t} tenant={tenant} />
                </div>
              ))
            )}
          </div>
        </Card>
      ) : (
        <div className="empty">พิมพ์คำค้นแล้วกดค้นหา</div>
      )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="hint">กำลังโหลด…</div>}>
      <SearchInner />
    </Suspense>
  );
}
