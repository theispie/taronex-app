'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Card, PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 29 · ลูกค้าและผู้ติดต่อ
 *
 * ผู้ติดต่อของลูกค้าไม่ใช่ users และไม่นับโควตาที่นั่ง
 * ไม่มีรหัสผ่าน เข้าพอร์ทัลด้วยลิงก์ใช้ครั้งเดียวเท่านั้น
 * ถอดออกแล้วเรื่องที่เขาเคยแจ้งยังอยู่ครบ
 */
interface Contact {
  id: string;
  name: string;
  email: string;
  canReport: boolean;
  canSeeAll: boolean;
}
interface ClientRow {
  id: string;
  name: string;
  code: string;
  contacts: number;
  projects: number;
  portalEnabled: boolean;
}

export default function ClientDetailPage() {
  const p = useParams();
  const tenant = String(p.tenant ?? '');
  const id = String(p.id ?? '');
  const [client, setClient] = useState<ClientRow | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, cs] = await Promise.all([
        api.get<ClientRow[]>(`/t/${tenant}/clients`),
        api.get<Contact[]>(`/t/${tenant}/clients/${id}/contacts`),
      ]);
      setClient(list.find((c) => c.id === id) ?? null);
      setContacts(cs);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/t/${tenant}/clients/${id}/contacts`, { name, email });
      setName('');
      setEmail('');
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(contactId: string) {
    setErr(null);
    try {
      await api.del(`/t/${tenant}/contacts/${contactId}`);
      await load();
    } catch (e2) {
      setErr(errorText(e2));
    }
  }

  return (
    <>
      <PageHead
        title={client?.name ?? 'ลูกค้า'}
        desc={
          client
            ? `${client.projects} โปรเจกต์ · ${client.contacts} ผู้ติดต่อ · พอร์ทัล${client.portalEnabled ? 'เปิดอยู่' : 'ยังไม่เปิด'}`
            : 'กำลังโหลด…'
        }
        right={
          <Link href={`/${tenant}/clients`} className="btn btn-2 btn-sm">
            กลับไปรายชื่อ
          </Link>
        }
      />

      {err ? (
        <div className="alert d" style={{ marginBottom: 14 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <Card className="mb">
        <div className="card-h">
          <b>ผู้ติดต่อที่เข้าพอร์ทัลได้</b>
          <div className="r">
            <span className="chip">ฟรี ไม่นับโควตา</span>
          </div>
        </div>
        <div className="card-b">
          {contacts.length === 0 ? (
            <div className="empty">ยังไม่มีผู้ติดต่อ</div>
          ) : (
            contacts.map((c) => (
              <div className="row" key={c.id}>
                <span className="row-title">{c.name}</span>
                <span className="sub mn">{c.email}</span>
                <span className="chip">{c.canReport ? 'แจ้งเรื่องได้' : 'ดูอย่างเดียว'}</span>
                <button type="button" className="btn btn-sm btn-dn" onClick={() => revoke(c.id)}>
                  เพิกถอนสิทธิ์
                </button>
              </div>
            ))
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            ถอดออกแล้วเรื่องที่เขาเคยแจ้งยังอยู่ครบ — ปิดแค่การเข้าถึง
          </div>
        </div>
      </Card>

      <Card>
        <div className="card-h">
          <b>เชิญผู้ติดต่อใหม่</b>
        </div>
        <form className="card-b" onSubmit={addContact}>
          <div className="fld">
            <span className="lbl">ชื่อ</span>
            <input
              className="inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="สมชาย ผู้ประสานงาน"
              required
            />
          </div>
          <div className="fld" style={{ marginBottom: 14 }}>
            <span className="lbl">อีเมล</span>
            <input
              className="inp mn"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@client.co.th"
              required
            />
          </div>
          <button type="submit" className="btn btn-ws" disabled={busy}>
            {busy ? 'กำลังเพิ่ม…' : 'ส่งคำเชิญเข้าพอร์ทัล'}
          </button>
          <div className="hint" style={{ marginTop: 8 }}>
            ไม่มีรหัสผ่าน — เข้าพอร์ทัลด้วยลิงก์ใช้ครั้งเดียวเท่านั้น
          </div>
        </form>
      </Card>
    </>
  );
}
