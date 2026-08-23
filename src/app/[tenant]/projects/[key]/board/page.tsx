'use client';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BoardCard } from '@/components/board/card';
import { MoveDialog } from '@/components/board/move-dialog';
import {
  type BoardColumn,
  type BoardMember,
  type BoardTask,
  columnTone,
} from '@/components/board/types';
import { ProjectTabs } from '@/components/project-tabs';
import { PageHead } from '@/components/ui';
import { api, errorText } from '@/lib/api-client';

/**
 * หน้าจอ 17 · บอร์ด  ·  17ข เมื่อ ?group=feature
 *
 * ═══ มุมมองเดียวกัน ข้อมูลเดียวกัน ต่างแค่วิธีจัดกลุ่ม ═══
 * สลับ "จัดตามคอลัมน์ | จัดตามงานหลัก" ไม่ได้เปลี่ยนข้อมูลที่ดึงมา
 * และไม่ได้เปลี่ยนกติกาใดๆ — จัดตามงานหลักแล้วลากข้ามงานหลักไม่ได้
 * เพราะการย้ายงานหลักไม่ใช่ transition (ใช้ PATCH /tasks/:id แทน)
 *
 * ═══ optimistic update และย้อนกลับเมื่อเซิร์ฟเวอร์ปฏิเสธ ═══
 * ย้ายการ์ดบนจอทันทีที่ปล่อยเมาส์ แล้วค่อยยิงเซิร์ฟเวอร์
 * ถ้าถูกปฏิเสธ (เช่น dev ลากเข้าคอลัมน์สุดท้าย) การ์ดต้องเด้งกลับที่เดิม
 * ไม่ใช่ค้างอยู่ผิดที่จนกว่าจะรีเฟรช
 */
function Column({
  col,
  index,
  total,
  tasks,
  showFeature,
  onOpen,
}: {
  col: BoardColumn;
  index: number;
  total: number;
  tasks: BoardTask[];
  showFeature: boolean;
  onOpen: (t: BoardTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}` });
  return (
    <div
      className="bcol"
      ref={setNodeRef}
      style={isOver ? { background: 'var(--brand-50)' } : undefined}
    >
      <div className="bd">
        <span className={`chip ${columnTone(index, total)}`}>{col.name}</span>
        <span className="sub mn">{tasks.length}</span>
        {index === total - 1 ? (
          <span className="sub" style={{ fontSize: 11 }}>
            PM เท่านั้น
          </span>
        ) : null}
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map((t) => (
          <BoardCard key={t.id} task={t} showFeature={showFeature} onOpen={onOpen} />
        ))}
      </SortableContext>
      {tasks.length === 0 ? <div className="empty">ว่าง</div> : null}
    </div>
  );
}

function BoardInner() {
  const p = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const tenant = String(p.tenant ?? '');
  const key = String(p.key ?? '');
  const groupByFeature = search.get('group') === 'feature';
  const openCode = search.get('card');

  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [features, setFeatures] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [youArePm, setYouArePm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const [ask, setAsk] = useState<{
    task: BoardTask;
    toKey: string;
    toName: string;
    kind: 'forward' | 'backward';
  } | null>(null);

  const sensors = useSensors(
    // ต้องลากให้ขยับ 6px ก่อนถึงนับเป็นลาก ไม่งั้นคลิกเปิดการ์ดจะกลายเป็นลากทุกครั้ง
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const load = useCallback(async () => {
    try {
      const [ts, proj, fs, ms] = await Promise.all([
        api.get<BoardTask[]>(`/t/${tenant}/projects/${key}/tasks`),
        api.get<{ board: BoardColumn[]; youArePm: boolean }>(`/t/${tenant}/projects/${key}`),
        api.get<{ id: string; name: string }[]>(`/t/${tenant}/projects/${key}/features`),
        api.get<BoardMember[]>(`/t/${tenant}/members`),
      ]);
      setTasks(ts);
      setColumns(proj.board);
      setYouArePm(proj.youArePm);
      setFeatures(fs);
      setMembers(ms);
    } catch (e) {
      setErr(errorText(e));
    }
  }, [tenant, key]);

  useEffect(() => {
    void load();
  }, [load]);

  /** เปิดลิ้นชักด้วยการเปลี่ยน URL — ปุ่มย้อนกลับของเบราว์เซอร์จึงปิดลิ้นชักได้ */
  function openCard(t: BoardTask) {
    const q = new URLSearchParams(search.toString());
    q.set('card', t.code);
    router.push(`?${q.toString()}`, { scroll: false });
  }
  function closeCard() {
    const q = new URLSearchParams(search.toString());
    q.delete('card');
    router.push(q.toString() ? `?${q.toString()}` : '?', { scroll: false });
  }

  // ปิดลิ้นชักด้วย Escape · ฟังที่ document ไม่ใช่ใส่ handler บน div ที่กดไม่ได้อยู่แล้ว
  useEffect(() => {
    if (!openCode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCard();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const over = e.over?.id;
    if (typeof over !== 'string' || !over.startsWith('col:')) return;

    const toKey = over.slice(4);
    const task = tasks.find((t) => t.id === e.active.id);
    if (!task || task.columnKey === toKey) return;

    const toIndex = columns.findIndex((c) => c.key === toKey);
    const toName = columns[toIndex]?.name ?? toKey;
    // ทิศทางเป็นตัวตัดสินว่าจะถามอะไร ไม่ใช่ชื่อคอลัมน์
    const kind = toIndex < task.columnIndex ? 'backward' : 'forward';
    setAsk({ task, toKey, toName, kind });
  }

  async function commit(v: { reason?: string; assigneeId?: string | null }) {
    if (!ask) return;
    const { task, toKey } = ask;
    const before = tasks;
    setAsk(null);
    setErr(null);

    // ย้ายบนจอก่อน แล้วค่อยยิงเซิร์ฟเวอร์
    const toIndex = columns.findIndex((c) => c.key === toKey);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, columnKey: toKey, columnIndex: toIndex } : t)),
    );

    try {
      await api.post(`/t/${tenant}/tasks/${task.id}/transition`, {
        toColumnKey: toKey,
        reason: v.reason,
        assigneeId: v.assigneeId,
      });
      await load();
    } catch (e) {
      // เซิร์ฟเวอร์ปฏิเสธ — การ์ดต้องเด้งกลับที่เดิม ไม่ใช่ค้างผิดที่
      setTasks(before);
      setErr(errorText(e));
    }
  }

  const lanes = useMemo(() => {
    if (!groupByFeature) return null;
    const rows = features.map((f) => ({ id: f.id, name: f.name }));
    rows.push({ id: '', name: 'งานนอกแผน' });
    return rows;
  }, [groupByFeature, features]);

  const openTask = openCode ? tasks.find((t) => t.code === openCode) : null;

  return (
    <>
      <PageHead
        title={`${key} · บอร์ด`}
        desc={`${tasks.length} การ์ด · ลากเพื่อย้าย`}
        right={
          <Link href={`/${tenant}/projects/${key}/tickets/new`} className="btn btn-pri btn-sm">
            ＋ การ์ดใหม่
          </Link>
        }
      />
      <ProjectTabs base={`/${tenant}/projects/${key}`} />

      <div className="tabs" style={{ marginBottom: 12 }}>
        <Link href={`/${tenant}/projects/${key}/board`} className={groupByFeature ? '' : 'on'}>
          จัดตามคอลัมน์
        </Link>
        <Link
          href={`/${tenant}/projects/${key}/board?group=feature`}
          className={groupByFeature ? 'on' : ''}
        >
          จัดตามงานหลัก
        </Link>
      </div>

      {err ? (
        <div className="alert d" style={{ marginBottom: 12 }}>
          <span>✕</span>
          <div>{err}</div>
        </div>
      ) : null}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {lanes ? (
          lanes.map((lane) => (
            <div key={lane.id || 'none'} style={{ marginBottom: 18 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>
                {lane.name}
              </div>
              <div className="bar4">
                {columns.map((c, i) => (
                  <Column
                    key={c.key}
                    col={c}
                    index={i}
                    total={columns.length}
                    showFeature={false}
                    onOpen={openCard}
                    tasks={tasks.filter(
                      (t) => t.columnKey === c.key && (t.featureId ?? '') === lane.id,
                    )}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bar4">
            {columns.map((c, i) => (
              <Column
                key={c.key}
                col={c}
                index={i}
                total={columns.length}
                showFeature
                onOpen={openCard}
                tasks={tasks.filter((t) => t.columnKey === c.key)}
              />
            ))}
          </div>
        )}

        <DragOverlay>
          {dragging ? (
            <div className="tk" style={{ boxShadow: 'var(--sh-3)' }}>
              <div className="cd mn">{dragging.code}</div>
              <div className="ti">{dragging.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {ask ? (
        <MoveDialog
          kind={ask.kind}
          toColumnName={ask.toName}
          members={members}
          onCancel={() => setAsk(null)}
          onConfirm={commit}
        />
      ) : null}

      {/* ลิ้นชักการ์ด — เปิดด้วย URL ปุ่มย้อนกลับจึงปิดได้ */}
      {openTask ? (
        <div className="pw">
          <div className="pw-card">
            <div className="pw-top">
              <b className="mn">{openTask.code}</b>
              <button type="button" className="btn btn-sm btn-gh" onClick={closeCard}>
                ปิด
              </button>
            </div>
            <div className="pw-in">
              <h2 style={{ fontSize: 15, marginBottom: 8 }}>{openTask.title}</h2>
              <div className="kv">
                <span>คอลัมน์</span>
                <b>{columns[openTask.columnIndex]?.name}</b>
              </div>
              <div className="kv">
                <span>ผู้รับผิดชอบ</span>
                <b>{openTask.assigneeName ?? 'ยังไม่มี'}</b>
              </div>
              <div className="kv">
                <span>งานหลัก</span>
                <b>{openTask.featureName ?? 'งานนอกแผน'}</b>
              </div>
              <Link
                href={`/${tenant}/tickets/${openTask.code}`}
                className="btn btn-pri btn-bl"
                style={{ marginTop: 12 }}
              >
                เปิดหน้าเต็ม
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hint" style={{ marginTop: 14 }}>
        คอลัมน์สุดท้ายคือปิดงาน · {youArePm ? 'คุณเป็น PM จึงย้ายมาได้' : 'PM เท่านั้นที่ย้ายมาได้'} · ลากถอยหลังคือตีกลับ
        ต้องใส่เหตุผลเสมอ
      </div>
    </>
  );
}

export default function BoardPage() {
  return (
    <Suspense fallback={<div className="hint">กำลังโหลดบอร์ด…</div>}>
      <BoardInner />
    </Suspense>
  );
}
