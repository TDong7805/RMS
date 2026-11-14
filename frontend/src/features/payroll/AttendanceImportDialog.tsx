import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Segmented } from '@/components/common/Segmented';
import { downloadAttendanceErrors, downloadAttendanceTemplate, importAttendance, previewAttendanceFile } from '@/api/payroll';
import { downloadBlob, ValidationError } from '@/lib/mock';
import { cn } from '@/lib/cn';
import type { AttendancePreview, ImportResult, PreviewLine, RawAttendanceLine } from '@/types';

type Filter = 'all' | 'valid' | 'duplicate' | 'error';
const STATUS = {
  valid: { label: 'Hợp lệ', variant: 'accent' },
  duplicate: { label: 'Trùng', variant: 'warning' },
  error: { label: 'Lỗi', variant: 'danger' },
} as const;

const raw = (l: PreviewLine): RawAttendanceLine => ({ rowNo: l.rowNo, user: l.user, date: l.date, checkIn: l.checkIn, checkOut: l.checkOut, note: l.note });
const dmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const hm = (v: string) => {
  if (/^\d*\.\d+$/.test(v)) {
    const m = Math.round((Number(v) % 1) * 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  return v;
};

/** UC-TN-10: nhập chấm công từ file Excel / CSV — chọn file, xem trước từng dòng, chọn cách xử lý dòng trùng, nhập. */
export function AttendanceImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [fileError, setFileError] = useState('');
  const [mode, setMode] = useState<'skip' | 'overwrite'>('skip');
  const [filter, setFilter] = useState<Filter>('all');
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setPreview(null);
    setFileError('');
    setMode('skip');
    setFilter('all');
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };
  const close = () => {
    reset();
    onClose();
  };

  const read = useMutation({
    mutationFn: previewAttendanceFile,
    onSuccess: (p) => {
      setPreview(p);
      setFileError('');
      setFilter(p.errorCount ? 'error' : 'all');
    },
    onError: (e) => {
      setPreview(null);
      setFileError(e instanceof ValidationError ? (e.fields.file ?? e.message) : e instanceof Error ? e.message : 'Không đọc được file');
    },
  });
  const save = useMutation({
    mutationFn: () => importAttendance(preview!.fileName, mode, preview!.lines.map(raw)),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Đã nhập ${r.imported + r.overwritten} dòng chấm công (${r.skipped} dòng bỏ qua, ${r.errors} dòng lỗi)`);
      onImported();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Không nhập được'),
  });
  const template = useMutation({
    mutationFn: downloadAttendanceTemplate,
    onSuccess: (b) => downloadBlob('mau-cham-cong.xlsx', b),
    onError: () => toast.error('Không tải được file mẫu'),
  });
  const errorsFile = useMutation({
    mutationFn: () => downloadAttendanceErrors(preview!.lines.filter((l) => l.status === 'error').map(raw)),
    onSuccess: (b) => downloadBlob('cham-cong-dong-loi.xlsx', b),
    onError: () => toast.error('Không tải được file dòng lỗi'),
  });

  const importCount = preview ? preview.validCount + (mode === 'overwrite' ? preview.duplicateCount : 0) : 0;
  const shown = (preview?.lines ?? []).filter((l) => filter === 'all' || l.status === filter);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      size="xl"
      title="Nhập chấm công từ Excel"
      description="File .xlsx hoặc .csv (tối đa 2 MB, 5.000 dòng). Cột: Tên đăng nhập (hoặc Email) · Ngày (dd/MM/yyyy) · Giờ vào · Giờ ra (HH:mm) · Ghi chú."
      footer={
        result ? (
          <Button onClick={close}>Đóng</Button>
        ) : preview ? (
          <>
            <Button variant="ghost" onClick={reset}>Chọn file khác</Button>
            {preview.errorCount ? (
              <Button variant="outline" leadingIcon={<Download size={15} />} loading={errorsFile.isPending} onClick={() => errorsFile.mutate()}>Tải các dòng lỗi</Button>
            ) : null}
            <span className="flex-1" />
            <Button disabled={importCount === 0} loading={save.isPending} onClick={() => save.mutate()}>
              {importCount === 0 ? 'Không có dòng nào hợp lệ để nhập' : `Nhập ${importCount} dòng hợp lệ`}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={close}>Đóng</Button>
        )
      }
    >
      {result ? (
        <div className="space-y-2 py-4 text-center">
          <FileSpreadsheet size={40} className="mx-auto text-[var(--accent)]" />
          <p className="text-[16px] font-bold">Đã nhập {result.imported + result.overwritten} dòng chấm công</p>
          <p className="text-[13.5px] text-[var(--text-secondary)]">
            Thêm mới {result.imported} · ghi đè {result.overwritten} · bỏ qua {result.skipped} · lỗi {result.errors}
          </p>
          {result.errors ? (
            <Button variant="outline" size="sm" leadingIcon={<Download size={15} />} loading={errorsFile.isPending} onClick={() => errorsFile.mutate()}>Tải các dòng lỗi</Button>
          ) : null}
        </div>
      ) : !preview ? (
        <div className="space-y-4">
          <label
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed px-6 py-10 text-center hover:border-[var(--accent)]',
              fileError ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]',
            )}
          >
            <Upload size={28} className="text-[var(--accent)]" />
            <span className="text-[15px] font-semibold">{read.isPending ? 'Đang đọc file…' : 'Chọn file chấm công'}</span>
            <span className="text-[12.5px] text-[var(--text-muted)]">.xlsx hoặc .csv</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="sr-only"
              aria-label="Chọn file chấm công"
              disabled={read.isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) read.mutate(f);
              }}
            />
          </label>
          {fileError ? <p className="text-[13px] text-[var(--danger)]">{fileError}</p> : null}
          <Button variant="outline" size="sm" leadingIcon={<Download size={15} />} loading={template.isPending} onClick={() => template.mutate()}>Tải file mẫu</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
            <FileSpreadsheet size={16} className="text-[var(--accent)]" />
            <b>{preview.fileName}</b>
            <span className="text-[var(--text-muted)]">· {preview.lines.length} dòng</span>
            <Badge variant="accent">{preview.validCount} hợp lệ</Badge>
            {preview.duplicateCount ? <Badge variant="warning">{preview.duplicateCount} trùng</Badge> : null}
            {preview.errorCount ? <Badge variant="danger">{preview.errorCount} lỗi</Badge> : null}
          </div>
          {preview.duplicateCount ? (
            <div className="flex flex-wrap items-center gap-2 rounded-item bg-[var(--warning-soft)] px-3 py-2 text-[13px]">
              <span>{preview.duplicateCount} dòng đã có chấm công cùng nhân viên, cùng ngày, cùng giờ vào:</span>
              <Segmented<'skip' | 'overwrite'>
                ariaLabel="Xử lý dòng trùng"
                value={mode}
                onChange={setMode}
                options={[{ value: 'skip', label: 'Bỏ qua' }, { value: 'overwrite', label: 'Ghi đè' }]}
              />
            </div>
          ) : null}
          <Segmented<Filter>
            ariaLabel="Lọc dòng"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `Tất cả (${preview.lines.length})` },
              { value: 'valid', label: `Hợp lệ (${preview.validCount})` },
              { value: 'duplicate', label: `Trùng (${preview.duplicateCount})` },
              { value: 'error', label: `Lỗi (${preview.errorCount})` },
            ]}
          />
          <div className="max-h-[48vh] overflow-auto rounded-item border border-[var(--border)]">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="sticky top-0 bg-[var(--bg-subtle)] text-left text-[12px] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Dòng</th>
                  <th className="px-3 py-2 font-semibold">Nhân viên</th>
                  <th className="px-3 py-2 font-semibold">Ngày</th>
                  <th className="px-3 py-2 font-semibold">Vào</th>
                  <th className="px-3 py-2 font-semibold">Ra</th>
                  <th className="px-3 py-2 text-right font-semibold">Số giờ</th>
                  <th className="px-3 py-2 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.rowNo} className={cn('border-t border-[var(--border)]', l.status === 'error' && 'bg-[var(--danger-soft)]')}>
                    <td className="px-3 py-1.5 font-mono">{l.rowNo}</td>
                    <td className="px-3 py-1.5">{l.userName ?? l.user}{l.userName ? <span className="ml-1 text-[var(--text-muted)]">({l.user})</span> : null}</td>
                    <td className="px-3 py-1.5 font-mono">{l.workDate ? dmy(l.workDate) : l.date}</td>
                    <td className="px-3 py-1.5 font-mono">{hm(l.checkIn)}</td>
                    <td className="px-3 py-1.5 font-mono">{l.checkOut ? hm(l.checkOut) : <span className="text-[var(--warning)]">Thiếu</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{l.status === 'error' ? '—' : l.hours.toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant={STATUS[l.status].variant}>{STATUS[l.status].label}</Badge>
                      {l.error ? <span className="ml-2 text-[var(--danger)]">{l.error}</span> : null}
                      {l.missingOut && l.status !== 'error' ? <span className="ml-2 text-[var(--warning)]">Thiếu giờ ra</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
