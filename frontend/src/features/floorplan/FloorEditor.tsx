import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { MousePointer2, Minus, Pencil, Plus, QrCode, Redo2, Square, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { StickySaveBar } from '@/components/common/StickySaveBar';
import { saveFloorLayout } from '@/api/tables';
import { CELL, PlanBackdrop, TableShape, WALL_STYLE, floorWindow, type PlanZone } from '@/features/ordering/floorParts';
import { qk } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { cn } from '@/lib/cn';
import type { Area, DiningTable, Floor, FloorTable, Wall, WallKind, Zone } from '@/types';

/*
 * Trình sửa sơ đồ một tầng (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B7):
 * khung trái chia nhóm Công cụ · Bàn · Đang chọn; giữa là lưới. Kéo bàn sang ô trống (vào vùng khu nào thì bàn thuộc khu đó),
 * vẽ tường thẳng trên đường kẻ lưới, khoanh vùng khu. Hoàn tác / làm lại. Thay đổi chỉ lưu khi bấm Lưu ở thanh dưới đáy.
 */

type Tool = 'select' | 'wall' | 'zone';
type Selection = { kind: 'table'; id: string } | { kind: 'wall'; index: number } | { kind: 'zone'; areaId: string } | null;

interface Draft {
  walls: Wall[];
  zones: Record<string, Zone | null>;
  /** Vị trí / khu mới của bàn đã kéo (bàn chưa kéo dùng vị trí đang lưu). */
  moved: Record<string, { x: number; y: number; areaId: string }>;
}

const sameZone = (a: Zone | null | undefined, b: Zone | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const overlap = (a: Zone, b: Zone) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inZone = (z: Zone | null | undefined, x: number, y: number) => Boolean(z && x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function FloorEditor({ floor, areas, tables, onAddTable, onEditTable, onDeleteTable, onShowQr }: {
  floor: Floor;
  /** Khu vực của tầng này. */
  areas: Area[];
  /** Bàn của các khu trên tầng này. */
  tables: DiningTable[];
  onAddTable: (areaId: string) => void;
  onEditTable: (t: DiningTable) => void;
  onDeleteTable: (t: DiningTable) => void;
  onShowQr: (t: DiningTable) => void;
}) {
  const initial = useMemo<Draft>(
    () => ({ walls: floor.walls, zones: Object.fromEntries(areas.map((a) => [a.id, a.zone])), moved: {} }),
    [floor.walls, areas],
  );
  const [history, setHistory] = useState<{ list: Draft[]; at: number }>({ list: [initial], at: 0 });
  const draft = history.list[history.at];
  // Dữ liệu tầng đổi từ máy chủ (sau khi lưu / tải lại): làm mới bản nháp nếu chưa sửa gì.
  const initialKey = JSON.stringify(initial);
  const lastKey = useRef(initialKey);
  const dirty =
    JSON.stringify(draft.walls) !== JSON.stringify(initial.walls) ||
    areas.some((a) => !sameZone(draft.zones[a.id], a.zone)) ||
    Object.entries(draft.moved).some(([id, m]) => {
      const t = tables.find((x) => x.id === id);
      return Boolean(t) && (t!.x !== m.x || t!.y !== m.y || t!.areaId !== m.areaId);
    });
  useEffect(() => {
    if (lastKey.current === initialKey) return;
    lastKey.current = initialKey;
    if (!dirty) setHistory({ list: [initial], at: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const commit = useCallback((next: Draft) => {
    setHistory((h) => ({ list: [...h.list.slice(0, h.at + 1), next].slice(-80), at: Math.min(h.at + 1, 79) }));
  }, []);
  const undo = () => setHistory((h) => ({ ...h, at: Math.max(0, h.at - 1) }));
  const redo = () => setHistory((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) }));
  const reset = () => { setHistory({ list: [initial], at: 0 }); setSel(null); };

  const [tool, setTool] = useState<Tool>('select');
  const [wallKind, setWallKind] = useState<WallKind>('inner');
  const [zoneArea, setZoneArea] = useState<string>(areas[0]?.id ?? '');
  const [sel, setSel] = useState<Selection>(null);

  /* ---------------------------------------------------------------- Vị trí bàn theo bản nháp */
  const placed = useMemo(
    () => tables.map((t) => ({ t, x: draft.moved[t.id]?.x ?? t.x, y: draft.moved[t.id]?.y ?? t.y, areaId: draft.moved[t.id]?.areaId ?? t.areaId })),
    [tables, draft.moved],
  );
  const occupant = (x: number, y: number, except?: string) => placed.find((p) => p.x === x && p.y === y && p.t.id !== except);
  const zoneAt = (x: number, y: number) => areas.find((a) => inZone(draft.zones[a.id], x, y));

  /* ---------------------------------------------------------------- Thu phóng vừa khung */
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(900);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = Math.max(0.35, Math.min(1, (boxW - 24) / (floor.cols * CELL)));
  const [zoomAdj, setZoomAdj] = useState(0);
  const zoom = Math.max(0.3, Math.min(1.4, +(fit + zoomAdj).toFixed(2)));
  const cell = CELL * zoom;
  const win = floorWindow(floor);

  /* ---------------------------------------------------------------- Kéo, vẽ */
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const [wallDraw, setWallDraw] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [zoneDraw, setZoneDraw] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const local = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };
  const cellOf = (px: number, py: number) => ({
    x: Math.max(0, Math.min(floor.cols - 1, Math.floor(px / cell))),
    y: Math.max(0, Math.min(floor.rows - 1, Math.floor(py / cell))),
  });
  const pointOf = (px: number, py: number) => ({
    x: Math.max(0, Math.min(floor.cols, Math.round(px / cell))),
    y: Math.max(0, Math.min(floor.rows, Math.round(py / cell))),
  });

  const onDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const { px, py } = local(e);
    const tableEl = (e.target as HTMLElement).closest<HTMLElement>('[data-table-id]');
    if (tool === 'select') {
      if (tableEl) {
        const id = tableEl.dataset.tableId!;
        const p = placed.find((q) => q.t.id === id)!;
        setDrag({ id, x: p.x, y: p.y, moved: false });
        setSel({ kind: 'table', id });
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
      const wi = draft.walls.findIndex((w) => distToSegment(px, py, w.x1 * cell, w.y1 * cell, w.x2 * cell, w.y2 * cell) <= Math.max(7, 9 * zoom));
      if (wi >= 0) return setSel({ kind: 'wall', index: wi });
      const c = cellOf(px, py);
      const z = zoneAt(c.x, c.y);
      setSel(z ? { kind: 'zone', areaId: z.id } : null);
      return;
    }
    canvasRef.current!.setPointerCapture(e.pointerId);
    if (tool === 'wall') {
      const p = pointOf(px, py);
      setWallDraw({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    } else if (tool === 'zone') {
      if (!zoneArea) return toast.error('Chọn khu vực cần vẽ vùng ở khung bên trái');
      const c = cellOf(px, py);
      setZoneDraw({ x1: c.x, y1: c.y, x2: c.x, y2: c.y });
    }
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!drag && !wallDraw && !zoneDraw) return;
    const { px, py } = local(e);
    if (drag) {
      const c = cellOf(px, py);
      if (c.x !== drag.x || c.y !== drag.y) setDrag({ ...drag, x: c.x, y: c.y, moved: true });
    } else if (wallDraw) {
      const p = pointOf(px, py);
      // Chỉ tường thẳng: theo chiều kéo dài hơn.
      const horizontal = Math.abs(p.x - wallDraw.x1) >= Math.abs(p.y - wallDraw.y1);
      setWallDraw({ ...wallDraw, x2: horizontal ? p.x : wallDraw.x1, y2: horizontal ? wallDraw.y1 : p.y });
    } else if (zoneDraw) {
      const c = cellOf(px, py);
      setZoneDraw({ ...zoneDraw, x2: c.x, y2: c.y });
    }
  };

  const onUp = () => {
    if (drag) {
      const p = placed.find((q) => q.t.id === drag.id)!;
      if (drag.moved && (drag.x !== p.x || drag.y !== p.y)) {
        const other = occupant(drag.x, drag.y, drag.id);
        if (other) toast.error(`Ô này đã có bàn ${other.t.code}`);
        else {
          const z = zoneAt(drag.x, drag.y);
          commit({ ...draft, moved: { ...draft.moved, [drag.id]: { x: drag.x, y: drag.y, areaId: z?.id ?? p.areaId } } });
        }
      }
      setDrag(null);
    }
    if (wallDraw) {
      const w = wallDraw;
      if (w.x1 !== w.x2 || w.y1 !== w.y2) {
        const wall: Wall = { kind: wallKind, x1: Math.min(w.x1, w.x2), y1: Math.min(w.y1, w.y2), x2: Math.max(w.x1, w.x2), y2: Math.max(w.y1, w.y2) };
        commit({ ...draft, walls: [...draft.walls, wall] });
        setSel({ kind: 'wall', index: draft.walls.length });
      }
      setWallDraw(null);
    }
    if (zoneDraw) {
      const z: Zone = { x: Math.min(zoneDraw.x1, zoneDraw.x2), y: Math.min(zoneDraw.y1, zoneDraw.y2), w: Math.abs(zoneDraw.x2 - zoneDraw.x1) + 1, h: Math.abs(zoneDraw.y2 - zoneDraw.y1) + 1 };
      const clash = areas.find((a) => a.id !== zoneArea && draft.zones[a.id] && overlap(draft.zones[a.id]!, z));
      if (clash) toast.error(`Vùng này chồng lên khu ${clash.name}`);
      else {
        // Bàn nằm trong vùng mới thì thuộc khu này.
        const moved = { ...draft.moved };
        placed.forEach((p) => {
          if (inZone(z, p.x, p.y) && p.areaId !== zoneArea) moved[p.t.id] = { x: p.x, y: p.y, areaId: zoneArea };
        });
        commit({ ...draft, zones: { ...draft.zones, [zoneArea]: z }, moved });
        setSel({ kind: 'zone', areaId: zoneArea });
      }
      setZoneDraw(null);
    }
  };

  const removeSelected = useCallback(() => {
    if (sel?.kind === 'wall') {
      commit({ ...draft, walls: draft.walls.filter((_, i) => i !== sel.index) });
      setSel(null);
    } else if (sel?.kind === 'zone') {
      commit({ ...draft, zones: { ...draft.zones, [sel.areaId]: null } });
      setSel(null);
    }
  }, [sel, draft, commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
      else if (e.key === 'Escape') { setSel(null); setTool('select'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [removeSelected]);

  /* ---------------------------------------------------------------- Lưu */
  const guard = useUnsavedGuard(dirty, { watchSearch: true });
  const save = useApiMutation(
    () =>
      saveFloorLayout(floor.id, {
        walls: draft.walls,
        zones: areas.map((a) => {
          const z = draft.zones[a.id];
          return { areaId: a.id, x: z?.x ?? null, y: z?.y ?? null, w: z?.w ?? null, h: z?.h ?? null };
        }),
        tables: placed.map((p) => ({ id: p.t.id, x: p.x, y: p.y, areaId: p.areaId })),
      }),
    {
      invalidate: [qk.floors, qk.areas, qk.tables, qk.liveFloor],
      success: () => `Đã lưu sơ đồ ${floor.name}`,
      onSuccess: () => {
        lastKey.current = '';
        setHistory((h) => ({ list: [h.list[h.at]], at: 0 }));
      },
    },
  );

  const zones: PlanZone[] = [
    ...areas.filter((a) => draft.zones[a.id]).map((a) => ({
      id: a.id,
      name: a.name,
      zone: draft.zones[a.id]!,
      active: (sel?.kind === 'zone' && sel.areaId === a.id) || (tool === 'zone' && zoneArea === a.id),
    })),
  ];
  const selTable = sel?.kind === 'table' ? placed.find((p) => p.t.id === sel.id) : null;
  const selWall = sel?.kind === 'wall' ? draft.walls[sel.index] : null;
  const selZoneArea = sel?.kind === 'zone' ? areas.find((a) => a.id === sel.areaId) : null;
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '—';
  const asFloorTable = (t: DiningTable): FloorTable => ({ ...t, order: null, reservation: null, supportRequest: false, paymentRequest: false, status: t.status });

  const TOOLS: { value: Tool; label: string; hint: string; icon: React.ReactNode }[] = [
    { value: 'select', label: 'Chọn & kéo', hint: 'Kéo bàn sang ô trống. Bấm tường / vùng để chọn, phím Delete để xóa.', icon: <MousePointer2 size={16} /> },
    { value: 'wall', label: 'Vẽ tường', hint: 'Bấm giữ ở một góc ô rồi kéo ngang hoặc dọc.', icon: <Pencil size={16} /> },
    { value: 'zone', label: 'Vẽ vùng khu', hint: 'Chọn khu bên dưới rồi kéo trên lưới để khoanh vùng. Bàn trong vùng thuộc khu đó.', icon: <Square size={16} /> },
  ];

  return (
    <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* ------------------------------------------------ Khung trái */}
        <aside className="space-y-3">
          <section className="rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Công cụ</h3>
            <div className="mt-2 grid gap-1">
              {TOOLS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={tool === t.value}
                  onClick={() => { setTool(t.value); setSel(null); }}
                  className={cn('flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] font-medium transition-colors', tool === t.value ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]')}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 px-1 text-[12px] leading-relaxed text-[var(--text-muted)]">{TOOLS.find((t) => t.value === tool)!.hint}</p>
            {tool === 'wall' ? (
              <div className="mt-2 grid gap-1">
                {(Object.keys(WALL_STYLE) as WallKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={wallKind === k}
                    onClick={() => setWallKind(k)}
                    className={cn('flex items-center gap-3 rounded-[10px] border px-2.5 py-2 text-[13px]', wallKind === k ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--bg-subtle)]')}
                  >
                    <svg width={34} height={8} aria-hidden><line x1={2} y1={4} x2={32} y2={4} stroke={WALL_STYLE[k].color} strokeWidth={WALL_STYLE[k].width * 0.7} strokeDasharray={WALL_STYLE[k].dash} strokeLinecap="round" /></svg>
                    {WALL_STYLE[k].label}
                  </button>
                ))}
              </div>
            ) : null}
            {tool === 'zone' ? (
              <div className="mt-2 grid gap-1">
                {areas.length === 0 ? <p className="px-1 text-[12.5px] text-[var(--text-muted)]">Tầng này chưa có khu vực. Bấm "Thêm khu vực" ở đầu trang.</p> : null}
                {areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={zoneArea === a.id}
                    onClick={() => setZoneArea(a.id)}
                    className={cn('flex items-center justify-between gap-2 rounded-[10px] border px-2.5 py-2 text-left text-[13px]', zoneArea === a.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--bg-subtle)]')}
                  >
                    <span className="truncate font-medium">{a.name}</span>
                    <span className={cn('shrink-0 text-[11.5px]', draft.zones[a.id] ? 'text-[var(--accent)]' : 'text-[var(--warning)]')}>{draft.zones[a.id] ? 'Đã vẽ' : 'Chưa vẽ'}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Bàn</h3>
            <p className="mt-1 px-1 text-[12.5px] text-[var(--text-secondary)]">{tables.length} bàn · {tables.reduce((s, t) => s + (t.status === 'inactive' ? 0 : t.seats), 0)} ghế đang dùng</p>
            <Button size="sm" variant="outline" className="mt-2 w-full" leadingIcon={<Plus size={14} />} disabled={areas.length === 0} onClick={() => onAddTable(selZoneArea?.id ?? (tool === 'zone' ? zoneArea : areas[0]?.id ?? ''))}>
              Thêm bàn
            </Button>
          </section>

          <section className="rounded-item border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <h3 className="px-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Đang chọn</h3>
            {selTable ? (
              <div className="mt-2 space-y-2 px-1 text-[13px]">
                <p className="text-[15px] font-bold">Bàn {selTable.t.code}</p>
                <p className="text-[var(--text-secondary)]">{selTable.t.seats} ghế · khu <b>{areaName(selTable.areaId)}</b>{selTable.areaId !== selTable.t.areaId ? ' (sẽ đổi khi lưu)' : ''}</p>
                <p className="font-mono text-[12px] text-[var(--text-muted)]">Cột {selTable.x + 1}, hàng {selTable.y + 1}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="outline" leadingIcon={<Pencil size={13} />} onClick={() => onEditTable(selTable.t)}>Sửa thông tin</Button>
                  <Button size="sm" variant="ghost" leadingIcon={<QrCode size={13} />} onClick={() => onShowQr(selTable.t)}>Mã QR</Button>
                  <Button size="sm" variant="ghost" className="text-[var(--danger)]" leadingIcon={<Trash2 size={13} />} onClick={() => onDeleteTable(selTable.t)}>Xóa bàn</Button>
                </div>
              </div>
            ) : selWall ? (
              <div className="mt-2 space-y-2 px-1 text-[13px]">
                <p className="text-[15px] font-bold">Đoạn tường</p>
                <p className="text-[var(--text-secondary)]">Dài {Math.abs(selWall.x2 - selWall.x1) + Math.abs(selWall.y2 - selWall.y1)} ô</p>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(WALL_STYLE) as WallKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={selWall.kind === k}
                      onClick={() => commit({ ...draft, walls: draft.walls.map((w, i) => (sel?.kind === 'wall' && i === sel.index ? { ...w, kind: k } : w)) })}
                      className={cn('rounded-full border px-2.5 py-1 text-[12px]', selWall.kind === k ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border)]')}
                    >
                      {WALL_STYLE[k].label}
                    </button>
                  ))}
                </div>
                <Button size="sm" variant="ghost" className="text-[var(--danger)]" leadingIcon={<Trash2 size={13} />} onClick={removeSelected}>Xóa đoạn tường</Button>
              </div>
            ) : selZoneArea && draft.zones[selZoneArea.id] ? (
              <div className="mt-2 space-y-2 px-1 text-[13px]">
                <p className="text-[15px] font-bold">Vùng khu {selZoneArea.name}</p>
                <p className="text-[var(--text-secondary)]">{draft.zones[selZoneArea.id]!.w} × {draft.zones[selZoneArea.id]!.h} ô · {placed.filter((p) => p.areaId === selZoneArea.id).length} bàn</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { setTool('zone'); setZoneArea(selZoneArea.id); }}>Vẽ lại vùng</Button>
                  <Button size="sm" variant="ghost" className="text-[var(--danger)]" leadingIcon={<Trash2 size={13} />} onClick={removeSelected}>Xóa vùng</Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 px-1 text-[12.5px] text-[var(--text-muted)]">Bấm vào bàn, tường hoặc vùng khu trên sơ đồ.</p>
            )}
          </section>
        </aside>

        {/* ------------------------------------------------ Lưới */}
        <section className="min-w-0 rounded-item border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" disabled={history.at === 0} onClick={undo}><Undo2 size={15} /></Button>
              <Button size="sm" variant="ghost" aria-label="Làm lại" title="Làm lại (Ctrl+Y)" disabled={history.at >= history.list.length - 1} onClick={redo}><Redo2 size={15} /></Button>
              <span className="ml-2 text-[12.5px] text-[var(--text-muted)]">{floor.name} · {floor.cols} × {floor.rows} ô</span>
            </div>
            <div className="flex items-center gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1">
              <button type="button" aria-label="Thu nhỏ" onClick={() => setZoomAdj((z) => +(z - 0.1).toFixed(2))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Minus size={14} /></button>
              <button type="button" onClick={() => setZoomAdj(0)} className="w-12 text-center font-mono text-[12px] font-semibold" title="Vừa khung">{Math.round(zoom * 100)}%</button>
              <button type="button" aria-label="Phóng to" onClick={() => setZoomAdj((z) => +(z + 0.1).toFixed(2))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Plus size={14} /></button>
            </div>
          </div>
          <div ref={boxRef} className="overflow-auto p-3">
            <div
              ref={canvasRef}
              className={cn('relative mx-auto touch-none select-none rounded-[14px] bg-[var(--bg-surface)]', tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
              style={{ width: floor.cols * cell, height: floor.rows * cell }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => { setDrag(null); setWallDraw(null); setZoneDraw(null); }}
              data-testid="floor-editor"
            >
              <PlanBackdrop win={win} cell={cell} walls={draft.walls} zones={zones}>
                {selWall ? (
                  <line x1={selWall.x1 * cell} y1={selWall.y1 * cell} x2={selWall.x2 * cell} y2={selWall.y2 * cell} stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={16 * zoom} strokeLinecap="round" />
                ) : null}
                {wallDraw ? (
                  <line x1={wallDraw.x1 * cell} y1={wallDraw.y1 * cell} x2={wallDraw.x2 * cell} y2={wallDraw.y2 * cell} stroke={WALL_STYLE[wallKind].color} strokeWidth={WALL_STYLE[wallKind].width} strokeDasharray={WALL_STYLE[wallKind].dash} strokeLinecap="round" opacity={0.7} />
                ) : null}
                {zoneDraw ? (
                  <rect
                    x={Math.min(zoneDraw.x1, zoneDraw.x2) * cell} y={Math.min(zoneDraw.y1, zoneDraw.y2) * cell}
                    width={(Math.abs(zoneDraw.x2 - zoneDraw.x1) + 1) * cell} height={(Math.abs(zoneDraw.y2 - zoneDraw.y1) + 1) * cell}
                    fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={2} rx={10}
                  />
                ) : null}
                {drag?.moved ? (
                  <rect x={drag.x * cell + 3} y={drag.y * cell + 3} width={cell - 6} height={cell - 6} rx={12}
                    fill={occupant(drag.x, drag.y, drag.id) ? 'var(--danger)' : 'var(--accent)'} fillOpacity={0.15}
                    stroke={occupant(drag.x, drag.y, drag.id) ? 'var(--danger)' : 'var(--accent)'} strokeWidth={2} strokeDasharray="6 4" />
                ) : null}
              </PlanBackdrop>
              {placed.map((p) => (
                <div
                  key={p.t.id}
                  data-table-id={p.t.id}
                  className={cn('absolute grid place-items-center', tool === 'select' && 'cursor-grab active:cursor-grabbing', drag?.id === p.t.id && drag.moved && 'opacity-40')}
                  style={{ left: p.x * cell, top: p.y * cell, width: cell, height: cell, pointerEvents: tool === 'select' ? 'auto' : 'none' }}
                >
                  <TableShape t={asFloorTable(p.t)} zoom={zoom} selected={sel?.kind === 'table' && sel.id === p.t.id} onClick={() => setSel({ kind: 'table', id: p.t.id })} />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[var(--border)] px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
            {(Object.keys(WALL_STYLE) as WallKind[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <svg width={22} height={6} aria-hidden><line x1={1} y1={3} x2={21} y2={3} stroke={WALL_STYLE[k].color} strokeWidth={WALL_STYLE[k].width * 0.6} strokeDasharray={WALL_STYLE[k].dash ? '5 3' : undefined} /></svg>
                {WALL_STYLE[k].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-[3px] border border-dashed border-[var(--accent)] bg-[var(--accent-soft)]" />Vùng khu</span>
          </div>
        </section>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={save.isPending}
        idleText="Chưa có thay đổi trên sơ đồ"
        summary={dirty ? `${history.at} bước sửa · Ctrl+Z để hoàn tác` : undefined}
        onDiscard={reset}
        onSave={() => save.mutate(undefined)}
      />
      {guard.dialog}
    </>
  );
}
