import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, RotateCcw, ScanFace, ShieldCheck, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import { PageHeader, PageTabs } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { approveFace, facePhotoUrl, FACE_KEYS, getFaces, rejectFace, resetFace, type FaceReviewStatus, type FaceRow } from '@/api/attendance-admin';
import { formatDateTime } from '@/lib/labels';

type Tab = FaceReviewStatus | 'all';
const STATUS: Record<FaceReviewStatus, { label: string; variant: 'warning' | 'accent' | 'danger' }> = {
  pending: { label: 'Chờ duyệt', variant: 'warning' },
  approved: { label: 'Đã duyệt', variant: 'accent' },
  rejected: { label: 'Từ chối', variant: 'danger' },
};
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Quản lý nhân viên → Khuôn mặt chấm công: duyệt ảnh khuôn mặt nhân viên (phục vụ, thu ngân, bếp) tự đăng ký.
 * Duyệt xong nhân viên mới chấm công bằng khuôn mặt được. "Yêu cầu đăng ký lại" xóa khuôn mặt (kể cả đã duyệt).
 */
export default function FacesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('pending');
  const q = useQuery({ queryKey: FACE_KEYS.list(tab), queryFn: () => getFaces(tab) });
  const [rejecting, setRejecting] = useState<FaceRow | null>(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');
  const [resetting, setResetting] = useState<FaceRow | null>(null);
  const [zoom, setZoom] = useState<FaceRow | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: FACE_KEYS.all });
  const approve = useMutation({ mutationFn: approveFace, onSuccess: (f) => { toast.success(`Đã duyệt khuôn mặt của ${f.fullName}`); refresh(); }, onError: (e) => toast.error(errText(e, 'Không duyệt được')) });
  const reject = useMutation({
    mutationFn: () => rejectFace(rejecting!.id, reason),
    onSuccess: (f) => { toast.success(`Đã từ chối — ${f.fullName} sẽ được báo đăng ký lại`); setRejecting(null); refresh(); },
    onError: (e) => setReasonErr(errText(e, 'Không lưu được')),
  });
  const reset = useMutation({
    mutationFn: () => resetFace(resetting!.id),
    onSuccess: () => { toast.success(`Đã yêu cầu ${resetting!.fullName} đăng ký lại`); setResetting(null); refresh(); },
    onError: (e) => toast.error(errText(e, 'Không lưu được')),
  });

  return (
    <AppShell meta={{ label: 'Khuôn mặt chấm công', parent: 'Quản lý nhân viên' }}>
      <div className="min-w-0 space-y-4">
        <PageHeader
          title="Khuôn mặt chấm công"
          description="Nhân viên phục vụ, thu ngân, bếp tự đăng ký khuôn mặt trên điện thoại. Kiểm tra ảnh rõ mặt, đúng người rồi duyệt — sau đó nhân viên mới chấm công bằng khuôn mặt được."
        />
        <PageTabs<Tab>
          ariaLabel="Trạng thái"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'pending', label: 'Chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt' },
            { value: 'rejected', label: 'Từ chối' },
            { value: 'all', label: 'Tất cả' },
          ]}
        />
        {q.isError ? (
          <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />
        ) : !q.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
        ) : q.data.length === 0 ? (
          <Card className="p-5"><EmptyState icon={ScanFace} title={tab === 'pending' ? 'Không có khuôn mặt nào chờ duyệt' : 'Chưa có dữ liệu'} /></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {q.data.map((f) => (
              <Card key={f.id} className="overflow-hidden">
                <button type="button" onClick={() => setZoom(f)} className="block w-full bg-[var(--bg-subtle)]" title="Xem ảnh lớn">
                  <img src={facePhotoUrl(f.id)} alt={`Khuôn mặt ${f.fullName}`} className="mx-auto aspect-[3/4] h-64 object-cover" loading="lazy" />
                </button>
                <div className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold">{f.fullName}</p>
                      <p className="text-[12.5px] text-[var(--text-muted)]">@{f.username} · {f.roleName}</p>
                    </div>
                    <Badge variant={STATUS[f.status].variant}>{STATUS[f.status].label}</Badge>
                  </div>
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    Gửi lúc {formatDateTime(f.createdAt)}
                    <span className="mt-0.5 flex items-center gap-1 text-[var(--accent)]"><ShieldCheck size={13} /> Đã đồng ý thu thập dữ liệu khuôn mặt</span>
                  </p>
                  {f.reviewedAt ? <p className="text-[12.5px] text-[var(--text-muted)]">{f.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi {f.reviewedName ?? '—'} · {formatDateTime(f.reviewedAt)}</p> : null}
                  {f.rejectReason ? <p className="text-[12.5px] text-[var(--danger)]">Lý do: {f.rejectReason}</p> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {f.status !== 'approved' ? (
                      <Button size="sm" leadingIcon={<Check size={14} />} loading={approve.isPending && approve.variables === f.id} onClick={() => approve.mutate(f.id)}>Duyệt</Button>
                    ) : null}
                    {f.status === 'pending' ? (
                      <Button size="sm" variant="outline" leadingIcon={<X size={14} />} onClick={() => { setRejecting(f); setReason(''); setReasonErr(''); }}>Từ chối</Button>
                    ) : null}
                    <Button size="sm" variant="ghost" leadingIcon={<RotateCcw size={14} />} onClick={() => setResetting(f)}>Yêu cầu đăng ký lại</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Từ chối khuôn mặt – ${rejecting?.fullName ?? ''}`}
        description="Nhân viên sẽ nhận thông báo kèm lý do và đăng ký lại."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>Hủy</Button>
            <Button variant="danger" loading={reject.isPending} onClick={() => (reason.trim() ? reject.mutate() : setReasonErr('Vui lòng nhập lý do'))}>Từ chối</Button>
          </>
        }
      >
        <Field label="Lý do" htmlFor="reject-reason" required error={reasonErr}>
          <TextInput id="reject-reason" value={reason} maxLength={200} invalid={Boolean(reasonErr)} placeholder="Ảnh mờ / không đúng người / đeo khẩu trang…" onChange={(e) => { setReason(e.target.value); setReasonErr(''); }} />
        </Field>
      </Modal>

      <ConfirmDialog
        open={resetting !== null}
        onOpenChange={(o) => !o && setResetting(null)}
        title="Yêu cầu đăng ký lại?"
        description={resetting ? <>Khuôn mặt của <b>{resetting.fullName}</b> sẽ bị xóa. Nhân viên phải đăng ký lại và chờ duyệt trước khi chấm công tiếp.</> : null}
        confirmLabel="Xóa và yêu cầu đăng ký lại"
        loading={reset.isPending}
        onConfirm={() => reset.mutate()}
      />

      <Modal open={zoom !== null} onOpenChange={(o) => !o && setZoom(null)} title={zoom?.fullName ?? ''}>
        {zoom ? <img src={facePhotoUrl(zoom.id)} alt={`Khuôn mặt ${zoom.fullName}`} className="mx-auto max-h-[70vh] rounded-[12px]" /> : null}
      </Modal>
    </AppShell>
  );
}
