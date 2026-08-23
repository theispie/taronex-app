'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectTabs } from '@/components/project-tabs';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 37 · ไฟล์ของโปรเจกต์
 *
 * ═══ ไฟล์ไม่วิ่งผ่านเซิร์ฟเวอร์ของเราเลย ═══
 * ขอลิงก์จาก /attachments/presign แล้วเบราว์เซอร์ PUT ตรงไปที่เก็บไฟล์
 * เพราะเครื่องมี RAM 1 GB ถ้าไฟล์ 50 MB วิ่งผ่าน Next.js พร้อมกันสองสามคน
 * เครื่องจะถูก OOM killer ฆ่า
 *
 * ลิงก์ดาวน์โหลดก็ขอใหม่ทุกครั้ง อายุ 5 นาที ไม่ใช่ลิงก์ถาวรที่ส่งต่อกันได้
 */
interface FileRow {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  taskNumber: number | null;
  taskTitle: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

function sizeText(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function ProjectFilesPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<FileRow[] | null>(null);
  const [projectId, setProjectId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, proj] = await Promise.all([
        api.get<FileRow[]>(`/t/${tenant}/projects/${key}/files`),
        api.get<{ id: string }>(`/t/${tenant}/projects/${key}`),
      ]);
      setRows(list);
      setProjectId(proj.id);
    } catch (e) {
      setErr(errorText(e));
      setRows([]);
    }
  }, [tenant, key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      // 1) ขอลิงก์ — ตรวจสิทธิ์ ชนิดไฟล์ และขนาดที่นี่
      const ps = await api.post<{ uploadUrl: string; storageKey: string }>(
        `/t/${tenant}/attachments/presign`,
        {
          projectId,
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
        },
      );
      // 2) ส่งไฟล์ตรงไปที่เก็บไฟล์ ไม่ผ่านเซิร์ฟเวอร์เรา
      const put = await fetch(ps.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง');
      // 3) บันทึกข้อมูลไฟล์
      await api.post(`/t/${tenant}/attachments`, {
        projectId,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: ps.storageKey,
      });
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function download(id: string) {
    try {
      const r = await api.get<{ url: string }>(`/t/${tenant}/attachments/${id}/download`);
      window.open(r.url, '_blank', 'noopener');
    } catch (e) {
      setErr(errorText(e));
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/t/${tenant}/attachments/${id}`);
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  return (
    <>
      <PageHead
        title={`${key} · ไฟล์`}
        desc={rows === null ? 'กำลังโหลด…' : `${rows.length} ไฟล์ · สูงสุด 50 MB ต่อไฟล์`}
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card className="mb">
        <div className="card-b">
          <input
            ref={fileInput}
            type="file"
            className="inp"
            disabled={busy || !projectId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <div className="hint" style={{ marginTop: 8 }}>
            {busy ? 'กำลังอัปโหลด…' : 'ไฟล์ส่งตรงไปที่เก็บไฟล์ ไม่ผ่านเซิร์ฟเวอร์ของเรา'}
          </div>
        </div>
      </Card>

      <Card>
        {rows !== null && rows.length === 0 ? (
          <div className="empty">ยังไม่มีไฟล์</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ชื่อไฟล์</th>
                <th>ขนาด</th>
                <th>ผูกกับการ์ด</th>
                <th>อัปโหลดโดย</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.filename}</td>
                  <td className="mn sub">{sizeText(f.sizeBytes)}</td>
                  <td className="sub">{f.taskNumber ? `${key}-${f.taskNumber}` : 'ระดับโปรเจกต์'}</td>
                  <td className="sub">{f.uploadedByName ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-gh"
                      onClick={() => download(f.id)}
                    >
                      ดาวน์โหลด
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-dn"
                      onClick={() => remove(f.id)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="alert i" style={{ marginTop: 14 }}>
        <span>ℹ</span>
        <div>ลิงก์ดาวน์โหลดมีอายุ 5 นาที และขอใหม่ทุกครั้ง — ส่งต่อลิงก์ให้คนนอกไม่ได้</div>
      </div>
    </>
  );
}
