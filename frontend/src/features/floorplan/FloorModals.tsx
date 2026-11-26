import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { Field, SelectInput, TextArea, TextInput, ToggleRow } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { createArea, createFloor, createTable, updateArea, updateFloor, updateTable } from '@/api/tables';
import { qk } from '@/features/management/queries';
import { useApiMutation } from '@/hooks/use-api-mutation';
import { TABLE_SHAPE, TABLE_STATUS } from '@/lib/labels';
import type { Area, AreaInput, DiningTable, Floor, FloorInput, TableInput, TableShape, TableStatus } from '@/types';

/* =========================================================== Tầng */

export function FloorModal({ state, onClose, onSaved }: {
  state: { open: boolean; floor: Floor | null };
  onClose: () => void;
  onSaved: (f: Floor) => void;
}) {
  const [form, setForm] = useState({ name: '', cols: '14', rows: '9' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!state.open) return;
    const f = state.floor;
    setForm(f ? { name: f.name, cols: String(f.cols), rows: String(f.rows) } : { name: '', cols: '14', rows: '9' });
    setErrors({});
  }, [state]);

  const mutation = useApiMutation((input: FloorInput) => (state.floor ? updateFloor(state.floor.id, input) : createFloor(input)), {
    invalidate: [qk.floors, qk.liveFloor],
    success: (f) => (state.floor ? `Đã cập nhật ${f.name}` : `Đã thêm ${f.name}`),
    onFieldErrors: setErrors,
    onSuccess: (f) => {
      onSaved(f);
      onClose();
    },
  });

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.floor ? `Sửa ${state.floor.name}` : 'Thêm tầng'}
      description="Mỗi tầng là một sơ đồ lưới; mỗi ô đặt được một bàn."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" form="floor-form" loading={mutation.isPending}>Lưu</Button>
        </>
      }
    >
      <form
        id="floor-form"
        noValidate
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return setErrors({ name: 'Vui lòng nhập tên tầng' });
          mutation.mutate({ name: form.name, cols: Number(form.cols), rows: Number(form.rows) });
        }}
      >
        <Field label="Tên tầng" htmlFor="f-name" required error={errors.name} className="col-span-2">
          <TextInput id="f-name" value={form.name} maxLength={50} invalid={Boolean(errors.name)} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Tầng 3, Sân thượng" />
        </Field>
        <Field label="Chiều ngang (ô)" htmlFor="f-cols" required error={errors.cols} hint="6 – 40 ô">
          <TextInput id="f-cols" type="number" min={6} max={40} value={form.cols} invalid={Boolean(errors.cols)} onChange={(e) => setForm({ ...form, cols: e.target.value })} />
        </Field>
        <Field label="Chiều dọc (ô)" htmlFor="f-rows" required error={errors.rows} hint="4 – 30 ô">
          <TextInput id="f-rows" type="number" min={4} max={30} value={form.rows} invalid={Boolean(errors.rows)} onChange={(e) => setForm({ ...form, rows: e.target.value })} />
        </Field>
      </form>
    </Modal>
  );
}

/* =========================================================== Khu vực */

export function AreaModal({ state, floors, defaultFloorId, onClose, onSaved }: {
  state: { open: boolean; area: Area | null };
  floors: Floor[];
  defaultFloorId: string;
  onClose: () => void;
  onSaved?: (area: Area) => void;
}) {
  const [form, setForm] = useState<AreaInput>({ name: '', description: '', active: true, floorId: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!state.open) return;
    const a = state.area;
    setForm(a ? { name: a.name, description: a.description, active: a.active, floorId: a.floorId } : { name: '', description: '', active: true, floorId: defaultFloorId });
    setErrors({});
  }, [state, defaultFloorId]);

  const mutation = useApiMutation((input: AreaInput) => (state.area ? updateArea(state.area.id, input) : createArea(input)), {
    invalidate: [qk.areas, qk.liveFloor],
    success: (a) => (state.area ? `Đã cập nhật khu vực ${a.name}` : `Đã thêm khu vực ${a.name}`),
    onFieldErrors: setErrors,
    onSuccess: (a) => {
      onSaved?.(a);
      onClose();
    },
  });

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.area ? 'Sửa khu vực' : 'Thêm khu vực'}
      description={state.area ? undefined : 'Sau khi thêm, vào "Sửa sơ đồ" → Vẽ vùng khu để khoanh khu trên sơ đồ tầng.'}
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
          <TextInput id="a-name" value={form.name} invalid={Boolean(errors.name)} maxLength={50} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Sảnh chính, Sân vườn" />
        </Field>
        <Field label="Thuộc tầng" htmlFor="a-floor" required error={errors.floorId} hint={state.area ? 'Khu còn bàn thì không chuyển tầng được' : undefined}>
          <SelectInput id="a-floor" value={form.floorId} invalid={Boolean(errors.floorId)} onChange={(e) => setForm({ ...form, floorId: e.target.value })} options={floors.map((f) => ({ value: f.id, label: f.name }))} />
        </Field>
        <Field label="Mô tả" htmlFor="a-desc" error={errors.description}>
          <TextArea id="a-desc" rows={2} maxLength={200} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <ToggleRow title="Đang phục vụ" description="Tắt để tạm ngưng nhận khách và đặt bàn ở khu vực này" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
      </form>
    </Modal>
  );
}

/* =========================================================== Bàn */

export function TableModal({ state, areas, defaultAreaId, onClose, onSaved }: {
  state: { open: boolean; table: DiningTable | null };
  areas: Area[];
  defaultAreaId: string;
  onClose: () => void;
  onSaved?: (t: DiningTable) => void;
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

  const mutation = useApiMutation((input: TableInput) => (state.table ? updateTable(state.table.id, input) : createTable(input)), {
    invalidate: [qk.tables, qk.liveFloor],
    success: (t) => (state.table ? `Đã cập nhật bàn ${t.code}` : `Đã thêm bàn ${t.code} vào sơ đồ`),
    onFieldErrors: setErrors,
    onSuccess: (t) => {
      onSaved?.(t);
      onClose();
    },
  });

  return (
    <Modal
      open={state.open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={state.table ? `Sửa bàn ${state.table.code}` : 'Thêm bàn'}
      description={state.table ? undefined : 'Bàn mới được đặt vào ô trống đầu tiên trong vùng của khu vực; kéo sang chỗ khác ở "Sửa sơ đồ".'}
      footer={
        <>
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
