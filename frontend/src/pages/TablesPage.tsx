import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Minus, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/Modal';
import { DataTable, PageHeader, PageTabs, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { RowActions } from '@/components/common/RowActions';
import { Skeleton } from '@/components/common/Skeleton';
import { deleteArea, deleteFloor, deleteTable } from '@/api/tables';
import { FloorEditor } from '@/features/floorplan/FloorEditor';
import { AreaModal, FloorModal, TableModal } from '@/features/floorplan/FloorModals';
import { TableQrDialog } from '@/features/ordering/TableQrDialog';
import { CELL, elapsed, FloorCanvas, floorWindow, guestsOf, hhmm, LEGEND, STATE, stateOf, type TableState } from '@/features/ordering/floorParts';
import { qk, useAreas, useFloors, useLiveFloor, useTables } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/cn';
import { TABLE_SHAPE, TABLE_STATUS } from '@/lib/labels';
import type { Area, DiningTable, Floor } from '@/types';

/*
 * Sơ đồ bàn (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B7 — chốt 26/11/2026).
 * Chọn tầng ở đầu trang; ba kiểu xem:
 *  - Xem trực tiếp: cùng cách vẽ với thu ngân / phục vụ (màu theo trạng thái đang diễn ra, đã ngồi bao lâu, giờ đặt), chỉ xem.
 *  - Sửa sơ đồ: trình sửa (bàn, tường, vùng khu), lưu một lần ở thanh dưới đáy.
 *  - Danh sách: khu vực của tầng + bảng bàn.
 */

type Mode = 'xem' | 'sua' | 'danh-sach';
const MODES: { value: Mode; label: string }[] = [
  { value: 'xem', label: 'Xem trực tiếp' },
  { value: 'sua', label: 'Sửa sơ đồ' },
  { value: 'danh-sach', label: 'Danh sách bàn' },
];

type Removal = { kind: 'area' | 'table' | 'floor'; id: string; name: string };

export function TablesPage() {
  const [params, setParams] = useSearchParams();
  const floorsQ = useFloors();
  const areasQ = useAreas();
  const tablesQ = useTables();
  const floors = useMemo(() => floorsQ.data ?? [], [floorsQ.data]);
  const areas = useMemo(() => areasQ.data ?? [], [areasQ.data]);
  const tables = useMemo(() => tablesQ.data ?? [], [tablesQ.data]);

  const floorId = floors.some((f) => f.id === params.get('tang')) ? params.get('tang')! : floors[0]?.id ?? '';
  const mode = (MODES.some((m) => m.value === params.get('che-do')) ? params.get('che-do') : 'xem') as Mode;
  const go = (next: { tang?: string; mode?: Mode }) => {
    const p = new URLSearchParams(params);
    if (next.tang) p.set('tang', next.tang);
    if (next.mode) {
      if (next.mode === 'xem') p.delete('che-do');
      else p.set('che-do', next.mode);
    }
    setParams(p);
  };

  const floor = floors.find((f) => f.id === floorId) ?? null;
  const floorAreas = useMemo(() => areas.filter((a) => a.floorId === floorId), [areas, floorId]);
  const floorTables = useMemo(() => tables.filter((t) => floorAreas.some((a) => a.id === t.areaId)), [tables, floorAreas]);

  const [floorModal, setFloorModal] = useState<{ open: boolean; floor: Floor | null }>({ open: false, floor: null });
  const [areaModal, setAreaModal] = useState<{ open: boolean; area: Area | null }>({ open: false, area: null });
  const [tableModal, setTableModal] = useState<{ open: boolean; table: DiningTable | null; areaId?: string }>({ open: false, table: null });
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const [removal, setRemoval] = useState<Removal | null>(null);

  const removeMutation = useApiMutation(
    (r: Removal) => (r.kind === 'area' ? deleteArea(r.id) : r.kind === 'floor' ? deleteFloor(r.id) : deleteTable(r.id)),
    {
      invalidate: [qk.floors, qk.areas, qk.tables, qk.liveFloor],
      success: (_res, r) => `Đã xóa ${r.kind === 'area' ? 'khu vực' : r.kind === 'floor' ? '' : 'bàn'} ${r.name}`.replace('  ', ' '),
      onSuccess: () => setRemoval(null),
    },
  );

  const loading = floorsQ.isLoading || areasQ.isLoading || tablesQ.isLoading;
  const failed = floorsQ.isError || areasQ.isError || tablesQ.isError;
  const tableCount = (fid: string) => tables.filter((t) => areas.some((a) => a.id === t.areaId && a.floorId === fid)).length;

  return (
    <AppShell meta={{ label: 'Sơ đồ bàn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Sơ đồ bàn"
          description="Tầng, khu vực và vị trí bàn — dùng chung cho thu ngân, phục vụ và trang đặt bàn của khách."
          actions={
            <>
              <Button variant="outline" leadingIcon={<Plus size={15} />} disabled={!floor} onClick={() => setAreaModal({ open: true, area: null })}>
                Thêm khu vực
              </Button>
              <Button leadingIcon={<Plus size={15} />} disabled={floorAreas.length === 0} onClick={() => setTableModal({ open: true, table: null, areaId: floorAreas[0]?.id })}>
                Thêm bàn
              </Button>
            </>
          }
        />

        {failed ? (
          <BlockError onRetry={() => { void floorsQ.refetch(); void areasQ.refetch(); void tablesQ.refetch(); }} />
        ) : loading ? (
          <Card><TableSkeleton rows={5} /></Card>
        ) : (
          <>
            {/* Chọn tầng */}
            <div className="flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Chọn tầng" className="flex flex-wrap gap-1 rounded-[12px] bg-[var(--bg-subtle)] p-1">
                {floors.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={f.id === floorId}
                    onClick={() => go({ tang: f.id })}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-[9px] px-3.5 text-[13.5px] font-semibold transition-colors',
                      f.id === floorId ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {f.name}
                    <span className="rounded-full bg-[var(--bg-subtle)] px-1.5 font-mono text-[11.5px] text-[var(--text-muted)]">{tableCount(f.id)}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" leadingIcon={<Plus size={14} />} onClick={() => setFloorModal({ open: true, floor: null })}>Thêm tầng</Button>
              {floor ? (
                <RowActions
                  name={floor.name}
                  items={[
                    { label: 'Đổi tên, kích thước tầng', icon: <Pencil size={15} />, onSelect: () => setFloorModal({ open: true, floor }) },
                    { label: 'Xóa tầng', icon: <Trash2 size={15} />, danger: true, onSelect: () => setRemoval({ kind: 'floor', id: floor.id, name: floor.name }) },
                  ]}
                />
              ) : null}
            </div>

            <PageTabs<Mode> ariaLabel="Kiểu xem sơ đồ" value={mode} onChange={(m) => go({ mode: m })} items={MODES} />

            {!floor ? (
              <EmptyState icon={LayoutGrid} title="Chưa có tầng nào" description="Bấm “Thêm tầng” để tạo sơ đồ đầu tiên." />
            ) : mode === 'sua' ? (
              <FloorEditor
                key={floor.id}
                floor={floor}
                areas={floorAreas}
                tables={floorTables}
                onAddTable={(areaId) => setTableModal({ open: true, table: null, areaId })}
                onEditTable={(t) => setTableModal({ open: true, table: t })}
                onDeleteTable={(t) => setRemoval({ kind: 'table', id: t.id, name: t.code })}
                onShowQr={setQrTable}
              />
            ) : mode === 'danh-sach' ? (
              <ListView
                areas={floorAreas}
                tables={floorTables}
                onEditArea={(a) => setAreaModal({ open: true, area: a })}
                onDeleteArea={(a) => setRemoval({ kind: 'area', id: a.id, name: a.name })}
                onEditTable={(t) => setTableModal({ open: true, table: t })}
                onDeleteTable={(t) => setRemoval({ kind: 'table', id: t.id, name: t.code })}
                onShowQr={setQrTable}
              />
            ) : (
              <LiveView floor={floor} tables={tables} onEditTable={(t) => setTableModal({ open: true, table: t })} onShowQr={setQrTable} />
            )}
          </>
        )}
      </div>

      <FloorModal state={floorModal} onClose={() => setFloorModal({ open: false, floor: null })} onSaved={(f) => go({ tang: f.id })} />
      <AreaModal state={areaModal} floors={floors} defaultFloorId={floorId} onClose={() => setAreaModal({ open: false, area: null })} />
      <TableModal
        state={tableModal}
        areas={areas}
        defaultAreaId={tableModal.areaId ?? floorAreas[0]?.id ?? ''}
        onClose={() => setTableModal({ open: false, table: null })}
      />
      <ConfirmDialog
        open={Boolean(removal)}
        onOpenChange={(o) => !o && setRemoval(null)}
        title={removal ? `Xóa ${removal.kind === 'area' ? 'khu vực' : removal.kind === 'floor' ? '' : 'bàn'} “${removal.name}”?`.replace('  ', ' ') : ''}
        description={
          removal?.kind === 'area'
            ? 'Chỉ xóa được khi khu vực không còn bàn và chưa có lịch sử đặt bàn. Muốn tạm ngưng thì tắt "Đang phục vụ".'
            : removal?.kind === 'floor'
              ? 'Chỉ xóa được khi tầng không còn khu vực nào. Tường và sơ đồ của tầng sẽ mất.'
              : 'Bàn bị xóa khỏi sơ đồ. Bàn có lịch đặt sắp tới hoặc đã có đơn hàng thì không xóa được — hãy chuyển sang "Ngưng sử dụng".'
        }
        confirmLabel="Xóa"
        loading={removeMutation.isPending}
        onConfirm={() => removal && removeMutation.mutate(removal)}
      />
      <TableQrDialog table={qrTable} onClose={() => setQrTable(null)} />
    </AppShell>
  );
}

/* =========================================================== Xem trực tiếp */

function LiveView({ floor, tables, onEditTable, onShowQr }: {
  floor: Floor;
  tables: DiningTable[];
  onEditTable: (t: DiningTable) => void;
  onShowQr: (t: DiningTable) => void;
}) {
  const q = useLiveFloor();
  const f = q.data;
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(900);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [f]);
  const [zoomAdj, setZoomAdj] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const fit = Math.max(0.35, Math.min(1, (boxW - 24) / (floor.cols * CELL)));
  const zoom = Math.max(0.3, Math.min(1.4, +(fit + zoomAdj).toFixed(2)));

  const live = useMemo(() => (f ? f.tables.filter((t) => f.areas.some((a) => a.id === t.areaId && a.floorId === floor.id)) : []), [f, floor.id]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(LEGEND.map((k) => [k, 0])) as Record<TableState, number>;
    live.forEach((t) => c[stateOf(t)]++);
    return c;
  }, [live]);
  const sel = live.find((t) => t.id === selected) ?? null;
  const selFull = tables.find((t) => t.id === selected) ?? null;

  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (!f) return <Skeleton className="h-[480px]" />;

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 rounded-item border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <p className="text-[12.5px] text-[var(--text-muted)]">Tự cập nhật 20 giây một lần · bấm bàn để xem chi tiết</p>
          <div className="flex items-center gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1">
            <button type="button" aria-label="Thu nhỏ" onClick={() => setZoomAdj((z) => +(z - 0.1).toFixed(2))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Minus size={14} /></button>
            <button type="button" onClick={() => setZoomAdj(0)} className="w-12 text-center font-mono text-[12px] font-semibold" title="Vừa khung">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="Phóng to" onClick={() => setZoomAdj((z) => +(z + 0.1).toFixed(2))} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-[var(--bg-surface)]"><Plus size={14} /></button>
          </div>
        </div>
        <div ref={boxRef} className="overflow-auto p-3" onClick={() => setSelected(null)}>
          <FloorCanvas floor={f} floorId={floor.id} win={floorWindow(floor)} tables={live} zoom={zoom} selected={selected} onSelect={(id) => setSelected(id === selected ? null : id)} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-[var(--border)] px-4 py-2.5">
          {LEGEND.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
              <span className="h-3 w-3 rounded-[4px]" style={{ background: STATE[k].bg }} />
              {STATE[k].label}
              <b className="font-mono text-[var(--text-primary)]">{counts[k]}</b>
            </span>
          ))}
        </div>
      </section>

      <Card padded className="self-start">
        {sel ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardHeader title={`Bàn ${sel.code}`} />
              <span className="rounded-full px-2 py-0.5 text-[12px] font-semibold" style={{ background: STATE[stateOf(sel)].bg, color: STATE[stateOf(sel)].fg }}>{STATE[stateOf(sel)].label}</span>
            </div>
            <dl className="space-y-1.5 text-[13px]">
              <Row label="Khu vực">{f.areas.find((a) => a.id === sel.areaId)?.name ?? '—'}</Row>
              <Row label="Số ghế">{guestsOf(sel) ? `${guestsOf(sel)} khách / ${sel.seats} ghế` : `${sel.seats} ghế`}</Row>
              {sel.order ? (
                <>
                  <Row label="Đơn">{sel.order.code} · đã ngồi {elapsed(sel.order.openedAt)}</Row>
                  <Row label="Tạm tính">{formatCurrency(sel.order.subtotal)}</Row>
                  {sel.order.pendingCount ? <Row label="Đang làm">{sel.order.pendingCount} món</Row> : null}
                  {sel.order.readyCount ? <Row label="Chờ mang ra">{sel.order.readyCount} món</Row> : null}
                </>
              ) : null}
              {sel.reservation ? <Row label="Đặt trước">{sel.reservation.customerName} · {hhmm(sel.reservation.time)} · {sel.reservation.guests} khách</Row> : null}
            </dl>
            {selFull ? (
              <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
                <Button size="sm" variant="outline" leadingIcon={<Pencil size={13} />} onClick={() => onEditTable(selFull)}>Sửa thông tin</Button>
                <Button size="sm" variant="ghost" leadingIcon={<QrCode size={13} />} onClick={() => onShowQr(selFull)}>Mã QR</Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <CardHeader title={floor.name} />
            <p className="text-[13px] text-[var(--text-secondary)]">{live.length} bàn · {live.filter((t) => t.order).length} bàn có khách · {live.reduce((s, t) => s + (t.status === 'inactive' ? 0 : t.seats), 0)} ghế</p>
            <p className="text-[12.5px] text-[var(--text-muted)]">Quản lý chỉ xem; mở bàn, gọi món, thanh toán do thu ngân và phục vụ làm. Muốn đổi vị trí bàn, tường, vùng khu thì vào “Sửa sơ đồ”.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

/* =========================================================== Danh sách */

function ListView({ areas, tables, onEditArea, onDeleteArea, onEditTable, onDeleteTable, onShowQr }: {
  areas: Area[];
  tables: DiningTable[];
  onEditArea: (a: Area) => void;
  onDeleteArea: (a: Area) => void;
  onEditTable: (t: DiningTable) => void;
  onDeleteTable: (t: DiningTable) => void;
  onShowQr: (t: DiningTable) => void;
}) {
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? '—';
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-5 pb-3"><CardHeader title="Khu vực trên tầng" /></div>
        {areas.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Tầng này chưa có khu vực. Bấm “Thêm khu vực”.</p>
        ) : (
          <DataTable minWidth={640}>
            <thead><tr><Th>Khu vực</Th><Th className="text-right">Số bàn</Th><Th>Vùng trên sơ đồ</Th><Th>Trạng thái</Th><Th className="text-right"><span className="sr-only">Thao tác</span></Th></tr></thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td><p className="font-semibold">{a.name}</p><p className="text-[12px] text-[var(--text-muted)]">{a.description || 'Không có mô tả'}</p></Td>
                  <Td className="text-right font-mono">{tables.filter((t) => t.areaId === a.id).length}</Td>
                  <Td className="text-[13px]">{a.zone ? `${a.zone.w} × ${a.zone.h} ô` : <span className="text-[var(--warning)]">Chưa vẽ</span>}</Td>
                  <Td>{a.active ? <Badge variant="accent">Đang phục vụ</Badge> : <Badge variant="neutral">Tạm ngưng</Badge>}</Td>
                  <Td className="text-right">
                    <RowActions name={a.name} onPrimary={() => onEditArea(a)} items={[{ label: 'Xóa khu vực', icon: <Trash2 size={15} />, danger: true, onSelect: () => onDeleteArea(a) }]} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
      <Card className="overflow-hidden">
        <div className="p-5 pb-3"><CardHeader title="Bàn" /></div>
        {tables.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState title="Tầng này chưa có bàn" description="Bấm “Thêm bàn” để tạo bàn." /></div>
        ) : (
          <DataTable minWidth={720}>
            <thead><tr><Th>Mã bàn</Th><Th>Khu vực</Th><Th className="text-right">Số ghế</Th><Th>Hình dạng</Th><Th>Vị trí</Th><Th>Trạng thái</Th><Th className="text-right"><span className="sr-only">Thao tác</span></Th></tr></thead>
            <tbody>
              {[...tables].sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })).map((t) => (
                <tr key={t.id} className="hover:bg-[var(--bg-subtle)]">
                  <Td className="font-mono font-semibold">{t.code}</Td>
                  <Td>{areaName(t.areaId)}</Td>
                  <Td className="text-right font-mono">{t.seats}</Td>
                  <Td>{TABLE_SHAPE[t.shape]}</Td>
                  <Td className="whitespace-nowrap font-mono text-[12.5px] text-[var(--text-muted)]">Cột {t.x + 1}, hàng {t.y + 1}</Td>
                  <Td><Badge variant={TABLE_STATUS[t.status].variant}>{TABLE_STATUS[t.status].label}</Badge></Td>
                  <Td className="text-right">
                    <RowActions
                      name={t.code}
                      onPrimary={() => onEditTable(t)}
                      items={[
                        { label: 'Mã QR gọi món', icon: <QrCode size={15} />, onSelect: () => onShowQr(t) },
                        { label: 'Xóa bàn', icon: <Trash2 size={15} />, danger: true, onSelect: () => onDeleteTable(t) },
                      ]}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>
    </div>
  );
}

export default TablesPage;
