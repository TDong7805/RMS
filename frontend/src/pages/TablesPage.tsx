import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, Move, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, SelectInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { DataTable, PageHeader, TableSkeleton, Td, Th } from '@/components/common/PageParts';
import { Segmented } from '@/components/common/Segmented';
import {
  FLOOR_COLS,
  FLOOR_ROWS,
  createArea,
  createTable,
  deleteArea,
  deleteTable,
  moveTable,
  updateArea,
  updateTable,
} from '@/api/tables';
import { qk, useAreas, useTables } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { cn } from '@/lib/cn';
import { TABLE_SHAPE, TABLE_STATUS } from '@/lib/labels';
import { errorMessage } from '@/lib/mock';
import type { Area, AreaInput, DiningTable, TableInput, TableShape, TableStatus } from '@/types';

type View = 'plan' | 'list';

const STATUS_COLORS: Record<TableStatus, string> = {
  available: 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]',
  reserved: 'border-[var(--info)] bg-[var(--info-soft)] text-[var(--info)]',
  occupied: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
  inactive: 'border-dashed border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-muted)]',
};

export function TablesPage() {
  const qc = useQueryClient();
  const areasQuery = useAreas();
  const tablesQuery = useTables();
  const areas = useMemo(() => areasQuery.data ?? [], [areasQuery.data]);
  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data]);

  const [areaId, setAreaId] = useState<string>('');
  const [view, setView] = useState<View>('plan');
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const [areaModal, setAreaModal] = useState<{ open: boolean; area: Area | null }>({ open: false, area: null });
  const [tableModal, setTableModal] = useState<{ open: boolean; table: DiningTable | null }>({ open: false, table: null });
  const [confirm, setConfirm] = useState<{ kind: 'area' | 'table'; id: string; name: string } | null>(null);

  useEffect(() => {
    if (!areaId && areas.length) setAreaId(areas[0].id);
    if (areaId && areas.length && !areas.some((a) => a.id === areaId)) setAreaId(areas[0].id);
  }, [areas, areaId]);

  const area = areas.find((a) => a.id === areaId) ?? null;
  const areaTables = tables.filter((t) => t.areaId === areaId);
  const seats = areaTables.reduce((s, t) => s + (t.status === 'inactive' ? 0 : t.seats), 0);

  const removeMutation = useApiMutation(
    (c: { kind: 'area' | 'table'; id: string; name: string }) => (c.kind === 'area' ? deleteArea(c.id) : deleteTable(c.id)),
    {
      invalidate: [qk.areas, qk.tables],
      success: (_r, c) => `Đã xóa ${c.kind === 'area' ? 'khu vực' : 'bàn'} ${c.name}`,
      onSuccess: () => setConfirm(null),
    },
  );

  const handleDrop = async (x: number, y: number) => {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const table = tables.find((t) => t.id === id);
    if (!table || (table.x === x && table.y === y)) return;
    if (areaTables.some((t) => t.id !== id && t.x === x && t.y === y)) {
      toast.error('Ô này đã có bàn khác');
      return;
    }
    // Cập nhật lạc quan để sơ đồ phản hồi ngay, hoàn tác nếu lưu thất bại.
    qc.setQueryData<DiningTable[]>(qk.tables, (prev) => prev?.map((t) => (t.id === id ? { ...t, x, y } : t)));
    try {
      await moveTable(id, x, y);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      void qc.invalidateQueries({ queryKey: qk.tables });
    }
  };

  const loading = areasQuery.isLoading || tablesQuery.isLoading;
  const failed = areasQuery.isError || tablesQuery.isError;

  return (
    <AppShell meta={{ label: 'Danh sách bàn', parent: 'Quản lý khu vực bàn' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Sơ đồ & danh sách bàn"
          description="Chỉnh sửa sơ đồ bàn theo từng khu vực phục vụ và cập nhật thông tin bàn."
          actions={
            <>
              <Button variant="outline" size="sm" leadingIcon={<Plus size={15} />} onClick={() => setAreaModal({ open: true, area: null })}>
                Thêm khu vực
              </Button>
              <Button size="sm" leadingIcon={<Plus size={15} />} onClick={() => setTableModal({ open: true, table: null })} disabled={!areas.length}>
                Thêm bàn
              </Button>
            </>
          }
        />

        {failed ? (
          <BlockError onRetry={() => { void areasQuery.refetch(); void tablesQuery.refetch(); }} />
        ) : loading ? (
          <Card><TableSkeleton rows={5} /></Card>
        ) : areas.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="Chưa có khu vực nào" description="Tạo khu vực phục vụ đầu tiên để bắt đầu sắp xếp bàn." />
        ) : (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="overflow-x-auto">
                <Segmented<string>
                  ariaLabel="Chọn khu vực"
                  value={areaId}
                  onChange={(v) => { setAreaId(v); setEditMode(false); }}
                  options={areas.map((a) => ({ value: a.id, label: a.name, count: tables.filter((t) => t.areaId === a.id).length }))}
                />
              </div>
              <Segmented<View>
                ariaLabel="Chế độ hiển thị"
                value={view}
                onChange={(v) => { setView(v); setEditMode(false); }}
                options={[{ value: 'plan', label: 'Sơ đồ' }, { value: 'list', label: 'Danh sách' }]}
              />
            </div>

            {area ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    {area.name}
                    {!area.active ? <Badge variant="neutral">Tạm ngưng</Badge> : null}
                  </p>
                  <p className="text-[12.5px] text-[var(--text-muted)]">
                    {area.description || 'Không có mô tả'} · {areaTables.length} bàn · {seats} ghế đang sử dụng
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {view === 'plan' ? (
                    <Button
                      size="sm"
                      variant={editMode ? 'primary' : 'outline'}
                      leadingIcon={<Move size={14} />}
                      onClick={() => setEditMode((v) => !v)}
                    >
                      {editMode ? 'Xong chỉnh sửa' : 'Chỉnh sửa sơ đồ'}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" leadingIcon={<Pencil size={14} />} onClick={() => setAreaModal({ open: true, area })}>
                    Sửa khu vực
                  </Button>
                  <Button size="sm" variant="ghost" leadingIcon={<Trash2 size={14} />} onClick={() => setConfirm({ kind: 'area', id: area.id, name: area.name })}>
                    Xóa
                  </Button>
                </div>
              </div>
            ) : null}

            {view === 'plan' ? (
              <div className="px-4 pb-5 sm:px-5">
                {editMode ? (
                  <p className="mb-2 rounded-[10px] bg-[var(--info-soft)] px-3 py-2 text-[12.5px] text-[var(--info)]">
                    Kéo bàn sang ô trống để đổi vị trí. Bấm vào bàn để sửa thông tin. Vị trí được lưu ngay sau khi thả.
                  </p>
                ) : null}
                <div className="overflow-x-auto">
                  <div
                    className="grid min-w-[640px] gap-2 rounded-item border border-[var(--border)] bg-[var(--bg-subtle)] p-3"
                    style={{ gridTemplateColumns: `repeat(${FLOOR_COLS}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: FLOOR_ROWS * FLOOR_COLS }).map((_, i) => {
                      const x = i % FLOOR_COLS;
                      const y = Math.floor(i / FLOOR_COLS);
                      const table = areaTables.find((t) => t.x === x && t.y === y);
                      return (
                        <div
                          key={i}
                          onDragOver={(e) => editMode && !table && e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            void handleDrop(x, y);
                          }}
                          className={cn(
                            'grid h-[96px] place-items-center rounded-[12px]',
                            editMode && !table && 'border border-dashed border-[var(--border-strong)]',
                            editMode && dragId && !table && 'bg-[var(--accent-soft)]/60',
                          )}
                        >
                          {table ? (
                            <button
                              type="button"
                              draggable={editMode}
                              onDragStart={() => setDragId(table.id)}
                              onDragEnd={() => setDragId(null)}
                              onClick={() => setTableModal({ open: true, table })}
                              title={`${table.code} · ${table.seats} ghế · ${TABLE_STATUS[table.status].label}`}
                              className={cn(
                                'flex flex-col items-center justify-center border-2 font-semibold transition-transform',
                                STATUS_COLORS[table.status],
                                table.shape === 'round' && 'h-[78px] w-[78px] rounded-full',
                                table.shape === 'square' && 'h-[74px] w-[74px] rounded-[12px]',
                                table.shape === 'rect' && 'h-[60px] w-[96%] max-w-[130px] rounded-[12px]',
                                editMode ? 'cursor-grab hover:scale-105 active:cursor-grabbing' : 'hover:scale-[1.03]',
                                dragId === table.id && 'opacity-40',
                              )}
                            >
                              <span className="font-mono text-[12.5px] leading-4">{table.code}</span>
                              <span className="flex items-center gap-0.5 text-[10.5px] font-medium opacity-80">
                                <Users size={10} />
                                {table.seats}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {(Object.keys(TABLE_STATUS) as TableStatus[]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                      <span className={cn('h-3 w-3 rounded-[4px] border-2', STATUS_COLORS[s])} />
                      {TABLE_STATUS[s].label}
                    </span>
                  ))}
                </div>
              </div>
            ) : areaTables.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState title="Khu vực chưa có bàn" description="Bấm “Thêm bàn” để tạo bàn cho khu vực này." />
              </div>
            ) : (
              <DataTable minWidth={640}>
                <thead>
                  <tr>
                    <Th>Mã bàn</Th>
                    <Th className="text-right">Số ghế</Th>
                    <Th>Hình dạng</Th>
                    <Th>Vị trí</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...areaTables].sort((a, b) => a.code.localeCompare(b.code)).map((t) => (
                    <tr key={t.id} className="hover:bg-[var(--bg-subtle)]">
                      <Td className="font-mono font-semibold">{t.code}</Td>
                      <Td className="text-right font-mono">{t.seats}</Td>
                      <Td>{TABLE_SHAPE[t.shape]}</Td>
                      <Td className="font-mono text-[12.5px] text-[var(--text-muted)]">Cột {t.x + 1}, hàng {t.y + 1}</Td>
                      <Td><Badge variant={TABLE_STATUS[t.status].variant}>{TABLE_STATUS[t.status].label}</Badge></Td>
                      <Td className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" aria-label={`Sửa bàn ${t.code}`} onClick={() => setTableModal({ open: true, table: t })}>
                            <Pencil size={14} />
                          </Button>
                          <Button size="sm" variant="ghost" aria-label={`Xóa bàn ${t.code}`} onClick={() => setConfirm({ kind: 'table', id: t.id, name: t.code })}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </Card>
        )}
      </div>

      <AreaModal state={areaModal} onClose={() => setAreaModal({ open: false, area: null })} onCreated={(a) => setAreaId(a.id)} />
      <TableModal
        state={tableModal}
        areas={areas}
        defaultAreaId={areaId}
        onClose={() => setTableModal({ open: false, table: null })}
        onDelete={(t) => {
          setTableModal({ open: false, table: null });
          setConfirm({ kind: 'table', id: t.id, name: t.code });
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === 'area' ? 'Xóa khu vực?' : 'Xóa bàn?'}
        description={
          confirm?.kind === 'area'
            ? `Khu vực "${confirm?.name}" sẽ bị xóa. Chỉ xóa được khi khu vực không còn bàn.`
            : `Bàn ${confirm?.name} sẽ bị xóa khỏi sơ đồ. Bàn có lịch đặt sắp tới sẽ không xóa được.`
        }
        confirmLabel="Xóa"
        loading={removeMutation.isPending}
        onConfirm={() => confirm && removeMutation.mutate(confirm)}
      />
    </AppShell>
  );
}

/* =========================================================== Modal khu vực */

function AreaModal({
  state,
  onClose,
  onCreated,
}: {
  state: { open: boolean; area: Area | null };
  onClose: () => void;
  onCreated: (area: Area) => void;
}) {
  const [form, setForm] = useState<AreaInput>({ name: '', description: '', active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.open) {
      setForm(state.area ? { name: state.area.name, description: state.area.description, active: state.area.active } : { name: '', description: '', active: true });
      setErrors({});
    }
  }, [state]);

  const mutation = useApiMutation(
    (input: AreaInput) => (state.area ? updateArea(state.area.id, input) : createArea(input)),
    {
      invalidate: [qk.areas],
      success: (a) => (state.area ? `Đã cập nhật khu vực ${a.name}` : `Đã thêm khu vực ${a.name}`),
      onFieldErrors: setErrors,
      onSuccess: (a) => {
        if (!state.area) onCreated(a);
        onClose();
      },
    },
  );

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.area ? 'Sửa khu vực' : 'Thêm khu vực'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="area-form" loading={mutation.isPending}>Lưu</Button>
        </>
      }
    >
      <form
        id="area-form"
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return setErrors({ name: 'Vui lòng nhập tên khu vực' });
          mutation.mutate(form);
        }}
      >
        <Field label="Tên khu vực" htmlFor="a-name" required error={errors.name}>
          <TextInput id="a-name" value={form.name} invalid={Boolean(errors.name)} maxLength={50} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Tầng 3" />
        </Field>
        <Field label="Mô tả" htmlFor="a-desc" error={errors.description}>
          <TextArea id="a-desc" rows={2} maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <ToggleRow title="Đang phục vụ" description="Tắt để tạm ngưng nhận đặt bàn ở khu vực này" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
      </form>
    </Modal>
  );
}

/* =========================================================== Modal bàn */

function TableModal({
  state,
  areas,
  defaultAreaId,
  onClose,
  onDelete,
}: {
  state: { open: boolean; table: DiningTable | null };
  areas: Area[];
  defaultAreaId: string;
  onClose: () => void;
  onDelete: (table: DiningTable) => void;
}) {
  const [form, setForm] = useState<TableInput>({ code: '', areaId: '', seats: 4, shape: 'square', status: 'available' });
  const [seatsText, setSeatsText] = useState('4');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    const t = state.table;
    const next: TableInput = t
      ? { code: t.code, areaId: t.areaId, seats: t.seats, shape: t.shape, status: t.status }
      : { code: '', areaId: defaultAreaId, seats: 4, shape: 'square', status: 'available' };
    setForm(next);
    setSeatsText(String(next.seats));
    setErrors({});
  }, [state, defaultAreaId]);

  const mutation = useApiMutation(
    (input: TableInput) => (state.table ? updateTable(state.table.id, input) : createTable(input)),
    {
      invalidate: [qk.tables],
      success: (t) => (state.table ? `Đã cập nhật bàn ${t.code}` : `Đã thêm bàn ${t.code} vào sơ đồ`),
      onFieldErrors: setErrors,
      onSuccess: onClose,
    },
  );

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.table ? `Sửa bàn ${state.table.code}` : 'Thêm bàn'}
      description={state.table ? undefined : 'Bàn mới được đặt vào ô trống đầu tiên của sơ đồ khu vực.'}
      footer={
        <>
          {state.table ? (
            <Button variant="ghost" className="mr-auto text-[var(--danger)]" leadingIcon={<Trash2 size={14} />} onClick={() => onDelete(state.table!)}>
              Xóa bàn
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="table-form" loading={mutation.isPending}>Lưu</Button>
        </>
      }
    >
      <form
        id="table-form"
        noValidate
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const seats = Number(seatsText);
          if (!Number.isInteger(seats)) return setErrors({ seats: 'Số ghế là số nguyên từ 1 đến 20' });
          mutation.mutate({ ...form, seats });
        }}
      >
        <Field label="Mã bàn" htmlFor="t-code" required error={errors.code}>
          <TextInput id="t-code" value={form.code} invalid={Boolean(errors.code)} maxLength={10} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="T10" />
        </Field>
        <Field label="Số ghế" htmlFor="t-seats" required error={errors.seats}>
          <TextInput id="t-seats" type="number" min={1} max={20} value={seatsText} invalid={Boolean(errors.seats)} onChange={(e) => setSeatsText(e.target.value)} />
        </Field>
        <Field label="Khu vực" htmlFor="t-area" required error={errors.areaId} className="col-span-2">
          <SelectInput id="t-area" value={form.areaId} invalid={Boolean(errors.areaId)} onChange={(e) => setForm({ ...form, areaId: e.target.value })} options={areas.map((a) => ({ value: a.id, label: a.name }))} placeholder="— Chọn khu vực —" />
        </Field>
        <Field label="Hình dạng" htmlFor="t-shape">
          <SelectInput id="t-shape" value={form.shape} onChange={(e) => setForm({ ...form, shape: e.target.value as TableShape })} options={(Object.keys(TABLE_SHAPE) as TableShape[]).map((s) => ({ value: s, label: TABLE_SHAPE[s] }))} />
        </Field>
        <Field label="Trạng thái" htmlFor="t-status">
          <SelectInput id="t-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TableStatus })} options={(Object.keys(TABLE_STATUS) as TableStatus[]).map((s) => ({ value: s, label: TABLE_STATUS[s].label }))} />
        </Field>
      </form>
    </Modal>
  );
}

export default TablesPage;
