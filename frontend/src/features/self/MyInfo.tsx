import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Printer,
  ScanFace,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BlockError, EmptyState } from '@/components/common/EmptyState';
import { Field, TextInput } from '@/components/common/Form';
import { Modal } from '@/components/common/Modal';
import { Skeleton } from '@/components/common/Skeleton';
import {
  clockIn,
  clockOut,
  enrollFace,
  getClock,
  getMyAttendance,
  getMyPayslip,
  getMyPayslips,
  getMyProfile,
  myAttendancePhotoUrl,
  myFacePhotoUrl,
  SELF_KEYS,
  updateMyProfile,
  type ClockStatus,
  type FaceCapture,
} from '@/api/self';
import { FaceCamera } from '@/features/self/FaceCamera';
import { MyShiftsView } from '@/features/self/MyShiftsView';
import { printPayslip } from '@/features/payroll/print';
import { formatCurrency } from '@/lib/format';
import { ValidationError } from '@/lib/mock';
import { cn } from '@/lib/cn';

/*
 * "Thông tin của tôi" — Nhân viên phục vụ, Thu ngân, Nhân viên bếp: chấm công bằng khuôn mặt, ca làm, lịch sử chấm công
 * (kèm ảnh), phiếu lương (kỳ đã chốt), hồ sơ. Hiện chưa trang nào dùng (26/11/2026 gỡ khỏi thu ngân / bếp / phục vụ) — giữ lại để dựng Cổng nhân viên /nhan-vien.
 */

type Tab = 'clock' | 'shifts' | 'history' | 'payslips' | 'profile';
const TABS: { id: Tab; label: string; icon: typeof Clock3 }[] = [
  { id: 'clock', label: 'Chấm công', icon: ScanFace },
  { id: 'shifts', label: 'Ca làm', icon: CalendarClock },
  { id: 'history', label: 'Lịch sử', icon: History },
  { id: 'payslips', label: 'Phiếu lương', icon: FileText },
  { id: 'profile', label: 'Hồ sơ', icon: UserRound },
];

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const dm = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function MyInfo() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'clock') as Tab;
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-[12px] bg-[var(--bg-subtle)] p-1" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'clock' ? {} : { tab: id }, { replace: true })}
            className={cn('inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2.5 text-[13px] font-semibold sm:flex-1', tab === id ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-secondary)]')}
          >
            <Icon size={15} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>
      {tab === 'clock' ? <ClockTab /> : tab === 'shifts' ? <MyShiftsView /> : tab === 'history' ? <HistoryTab /> : tab === 'payslips' ? <PayslipsTab /> : <ProfileTab />}
    </div>
  );
}

/* ---------------------------------------------------------------- Chấm công */

function ClockTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: SELF_KEYS.clock, queryFn: getClock, refetchInterval: 30_000 });
  const [camera, setCamera] = useState<'in' | 'out' | 'enroll' | null>(null);
  const [consent, setConsent] = useState(false);

  const done = (s: ClockStatus, msg: string) => {
    qc.setQueryData(SELF_KEYS.clock, s);
    void qc.invalidateQueries({ queryKey: SELF_KEYS.all });
    setCamera(null);
    toast.success(msg);
  };
  const fail = (e: unknown) => { setCamera(null); toast.error(errText(e, 'Không chấm công được'), { duration: 8000 }); void q.refetch(); };
  const inM = useMutation({ mutationFn: clockIn, onSuccess: (s) => done(s, s.open ? `Đã vào ca lúc ${hhmm(s.open.checkIn)}` : 'Đã vào ca'), onError: fail });
  const outM = useMutation({ mutationFn: clockOut, onSuccess: (s) => done(s, 'Đã tan ca — cảm ơn bạn!'), onError: fail });
  const enrollM = useMutation({
    mutationFn: (c: FaceCapture) => enrollFace({ descriptor: c.descriptor, photo: c.photo, consent }),
    onSuccess: () => { setCamera(null); toast.success('Đã gửi khuôn mặt — chờ quản lý duyệt'); void q.refetch(); },
    onError: (e) => { setCamera(null); toast.error(errText(e, 'Không đăng ký được')); },
  });
  const busy = inM.isPending || outM.isPending || enrollM.isPending;

  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const s = q.data;
  if (!s) return <Skeleton className="h-60" />;

  if (camera) {
    return (
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        {busy ? (
          <div className="grid h-60 place-items-center text-center text-[14px] text-[var(--text-secondary)]"><span><ScanFace size={36} className="mx-auto mb-2 animate-pulse text-[var(--accent)]" />Đang gửi và đối chiếu khuôn mặt…</span></div>
        ) : (
          <FaceCamera
            title={camera === 'enroll' ? 'Đăng ký khuôn mặt' : camera === 'in' ? 'Vào ca' : 'Tan ca'}
            onCancel={() => setCamera(null)}
            onCapture={(c) => (camera === 'enroll' ? enrollM.mutate(c) : camera === 'in' ? inM.mutate(c) : outM.mutate(c))}
          />
        )}
      </div>
    );
  }

  const face = s.face.status;
  return (
    <div className="space-y-3">
      {/* Camera chỉ mở được qua HTTPS (hoặc localhost) — báo sớm thay vì đợi bấm nút. */}
      {!window.isSecureContext ? (
        <div className="flex items-start gap-3 rounded-[14px] border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[13px]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <span>Trang đang mở bằng <b>http://</b> nên trình duyệt sẽ chặn camera. Hãy mở bằng địa chỉ <b>https://</b> của nhà hàng để chấm công bằng khuôn mặt.</span>
        </div>
      ) : null}
      {/* WiFi quán */}
      <div className={cn('flex items-center gap-3 rounded-[14px] border p-3', s.networkOk ? 'border-[var(--border)] bg-[var(--bg-surface)]' : 'border-[var(--danger)] bg-[var(--danger-soft)]')}>
        {s.networkOk ? <Wifi size={20} className="text-[var(--accent)]" /> : <WifiOff size={20} className="text-[var(--danger)]" />}
        <div className="min-w-0 text-[13.5px]">
          <p className="font-semibold">{!s.networkChecked ? 'Nhà hàng chưa giới hạn mạng WiFi' : s.networkOk ? 'Đang dùng WiFi của quán' : 'Bạn chưa kết nối WiFi của quán'}</p>
          <p className="text-[12px] text-[var(--text-muted)]">IP hiện tại: <span className="font-mono">{s.ip}</span></p>
        </div>
      </div>

      {/* Khuôn mặt chưa sẵn sàng → đăng ký */}
      {face !== 'approved' ? (
        <div className="space-y-3 rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-start gap-3">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', face === 'pending' ? 'bg-[var(--warning-soft)] text-[var(--warning)]' : face === 'rejected' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]')}>
              {face === 'rejected' ? <AlertTriangle size={20} /> : <ScanFace size={20} />}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold">{face === 'pending' ? 'Khuôn mặt đang chờ quản lý duyệt' : face === 'rejected' ? 'Khuôn mặt bị từ chối' : 'Đăng ký khuôn mặt để chấm công'}</p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {face === 'pending' ? 'Quản lý duyệt xong bạn sẽ nhận thông báo và chấm công được.'
                  : face === 'rejected' ? `Lý do: ${s.face.rejectReason ?? '—'}. Vui lòng đăng ký lại.`
                  : 'Chỉ cần làm một lần. Đứng nơi đủ sáng, không đeo khẩu trang / kính râm.'}
              </p>
            </div>
          </div>
          {face === 'pending' ? (
            <img src={myFacePhotoUrl()} alt="Ảnh khuôn mặt đã gửi" className="mx-auto h-40 w-32 rounded-[12px] object-cover" />
          ) : (
            <>
              <label className="flex items-start gap-2 rounded-[12px] bg-[var(--bg-subtle)] p-3 text-[13px]">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span>Tôi đồng ý cho nhà hàng thu thập ảnh và dữ liệu khuôn mặt của tôi <b>chỉ để chấm công</b>. Ảnh chấm công tự xóa sau thời gian lưu; dữ liệu khuôn mặt bị xóa khi tôi nghỉ việc (Nghị định 13/2023/NĐ-CP).</span>
              </label>
              <Button className="w-full" leadingIcon={<Camera size={16} />} disabled={!consent} onClick={() => setCamera('enroll')}>Mở camera đăng ký</Button>
            </>
          )}
        </div>
      ) : null}

      {/* Vào ca / tan ca */}
      <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        {s.open ? (
          <>
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--accent)]">Đang trong ca{s.open.shiftName ? ` · ${s.open.shiftName}` : ''}</p>
            <p className="mt-1 font-mono text-[28px] font-extrabold">Vào {hhmm(s.open.checkIn)}</p>
            {s.open.lateMinutes ? <p className="text-[13px] font-semibold text-[var(--danger)]">Đi trễ {s.open.lateMinutes} phút</p> : null}
            <Button className="mt-3 h-12 w-full text-[15px]" variant="danger" leadingIcon={<LogOut size={18} />} disabled={face !== 'approved' || !s.networkOk} onClick={() => setCamera('out')}>Tan ca bằng khuôn mặt</Button>
          </>
        ) : s.current ? (
          <>
            <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ca hiện tại</p>
            <p className="mt-1 text-[20px] font-extrabold">{s.current.shiftName} <span className="font-mono">{hhmm(s.current.start)}–{hhmm(s.current.end)}</span></p>
            {s.current.areaName ? <p className="text-[13px] text-[var(--text-secondary)]">Khu phụ trách: <b>{s.current.areaName}</b></p> : null}
            <Button className="mt-3 h-12 w-full text-[15px]" leadingIcon={<LogIn size={18} />} disabled={face !== 'approved' || !s.networkOk} onClick={() => setCamera('in')}>Vào ca bằng khuôn mặt</Button>
          </>
        ) : (
          <div className="text-center">
            <Clock3 size={28} className="mx-auto text-[var(--text-muted)]" />
            <p className="mt-1 text-[15px] font-bold">Bây giờ bạn không có ca nào</p>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {s.next ? <>Ca tiếp theo: <b>{s.next.shiftName}</b> lúc {hhmm(s.next.start)} ngày {dm(s.next.start)}</> : 'Chưa có ca nào trong 7 ngày tới.'}
            </p>
          </div>
        )}
        {face !== 'approved' && (s.open || s.current) ? <p className="mt-2 text-center text-[12.5px] text-[var(--text-muted)]">Cần khuôn mặt được duyệt trước khi chấm công.</p> : null}
        {face === 'approved' && !s.networkOk && (s.open || s.current) ? <p className="mt-2 text-center text-[12.5px] text-[var(--danger)]">Kết nối WiFi của quán để chấm công.</p> : null}
      </div>

      {s.recent.length ? (
        <div className="rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="mb-1.5 text-[13px] font-semibold">Gần đây</p>
          <ul className="divide-y divide-[var(--border)] text-[13.5px]">
            {s.recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>{dm(r.checkIn)} · <b className="font-mono">{hhmm(r.checkIn)}</b> → <b className="font-mono">{r.checkOut ? hhmm(r.checkOut) : '…'}</b></span>
                <span className="text-[12px]">
                  {r.lateMinutes ? <span className="text-[var(--danger)]">trễ {r.lateMinutes}′ </span> : null}
                  {r.earlyMinutes ? <span className="text-[var(--warning)]">sớm {r.earlyMinutes}′</span> : null}
                  {!r.lateMinutes && !r.earlyMinutes && r.checkOut ? <CheckCircle2 size={14} className="inline text-[var(--success)]" /> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Lịch sử chấm công */

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function HistoryTab() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const from = ymd(month);
  const to = ymd(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const q = useQuery({ queryKey: SELF_KEYS.attendance(from, to), queryFn: () => getMyAttendance(from, to) });
  const [photo, setPhoto] = useState<string | null>(null);
  const total = useMemo(() => (q.data ?? []).reduce((s, r) => s + r.hours, 0), [q.data]);
  const move = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[12px] bg-[var(--bg-surface)] p-1.5">
        <Button variant="ghost" size="sm" onClick={() => move(-1)}>‹ Tháng trước</Button>
        <span className="text-[14px] font-semibold">Tháng {month.getMonth() + 1}/{month.getFullYear()}</span>
        <Button variant="ghost" size="sm" onClick={() => move(1)}>Tháng sau ›</Button>
      </div>
      {q.isError ? <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} /> : !q.data ? <Skeleton className="h-40" /> : q.data.length === 0 ? (
        <EmptyState icon={History} title="Tháng này chưa có chấm công" />
      ) : (
        <>
          <p className="text-[13px] text-[var(--text-secondary)]">{q.data.length} lượt · tổng <b className="font-mono">{total.toLocaleString('vi-VN', { maximumFractionDigits: 2 })}</b> giờ</p>
          <ul className="space-y-2">
            {q.data.map((r) => (
              <li key={r.id} className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold">{r.date.split('-').reverse().join('/')}</span>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text-secondary)]">{r.source === 'camera' ? 'Khuôn mặt' : r.source === 'excel' ? 'Từ Excel' : 'Nhập tay'}</span>
                </div>
                <p className="mt-0.5 text-[14px]">
                  <b className="font-mono">{r.checkIn}</b> → <b className="font-mono">{r.checkOut ?? '—'}</b>{r.overnight ? ' (+1)' : ''} · {r.hours.toLocaleString('vi-VN')} giờ
                  {r.missingOut ? <span className="ml-1 font-semibold text-[var(--danger)]">· Thiếu giờ ra</span> : null}
                </p>
                <p className="text-[12.5px]">
                  {r.lateMinutes ? <span className="mr-2 text-[var(--danger)]">Đi trễ {r.lateMinutes} phút</span> : null}
                  {r.earlyMinutes ? <span className="text-[var(--warning)]">Về sớm {r.earlyMinutes} phút</span> : null}
                  {r.note ? <span className="text-[var(--text-muted)]">{r.note}</span> : null}
                </p>
                {r.hasInPhoto || r.hasOutPhoto ? (
                  <div className="mt-2 flex gap-2">
                    {r.hasInPhoto ? <button type="button" onClick={() => setPhoto(myAttendancePhotoUrl(r.id, 'in'))} className="text-[12.5px] font-semibold text-[var(--accent)]">Ảnh vào ca</button> : null}
                    {r.hasOutPhoto ? <button type="button" onClick={() => setPhoto(myAttendancePhotoUrl(r.id, 'out'))} className="text-[12.5px] font-semibold text-[var(--accent)]">Ảnh tan ca</button> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      <Modal open={photo !== null} onOpenChange={(o) => !o && setPhoto(null)} title="Ảnh chấm công">
        {photo ? <img src={photo} alt="Ảnh chấm công" className="mx-auto max-h-[60vh] rounded-[12px]" /> : null}
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------- Phiếu lương */

function PayslipsTab() {
  const q = useQuery({ queryKey: SELF_KEYS.payslips, queryFn: getMyPayslips });
  const print = useMutation({ mutationFn: getMyPayslip, onSuccess: printPayslip, onError: (e) => toast.error(errText(e, 'Không mở được phiếu lương')) });
  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (!q.data) return <Skeleton className="h-40" />;
  if (!q.data.length) return <EmptyState icon={FileText} title="Chưa có phiếu lương" description="Phiếu lương hiện ở đây khi kỳ lương đã được chốt." />;
  return (
    <ul className="space-y-2">
      {q.data.map((p) => (
        <li key={p.periodId} className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">{p.name}</p>
            <p className="text-[12.5px] text-[var(--text-muted)]">{p.startDate.split('-').reverse().join('/')} – {p.endDate.split('-').reverse().join('/')} · {p.hours.toLocaleString('vi-VN')} giờ</p>
            <p className="font-mono text-[16px] font-bold text-[var(--accent)]">{formatCurrency(p.total)}</p>
          </div>
          <Button variant="outline" size="sm" leadingIcon={<Printer size={14} />} loading={print.isPending && print.variables === p.periodId} onClick={() => print.mutate(p.periodId)}>Xem / in</Button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- Hồ sơ */

function ProfileTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: SELF_KEYS.profile, queryFn: getMyProfile });
  const [form, setForm] = useState<{ email: string; phone: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (p) => { qc.setQueryData(SELF_KEYS.profile, p); setForm(null); setErrors({}); toast.success('Đã lưu hồ sơ'); },
    onError: (e) => (e instanceof ValidationError ? setErrors(e.fields) : toast.error(errText(e, 'Không lưu được'))),
  });
  if (q.isError) return <BlockError onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  const p = q.data;
  if (!p) return <Skeleton className="h-40" />;
  const f = form ?? { email: p.email, phone: p.phone };
  return (
    <div className="space-y-3 rounded-[16px] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] font-mono text-[15px] font-bold text-[var(--accent)]">{p.fullName.split(' ').slice(-2).map((w) => w[0]).join('')}</span>
        <div>
          <p className="text-[16px] font-bold">{p.fullName}</p>
          <p className="text-[12.5px] text-[var(--text-muted)]">@{p.username} · {p.roleName} · {formatCurrency(p.hourlyRate)}/giờ</p>
        </div>
      </div>
      <Field label="Email" htmlFor="me-email" error={errors.email} required>
        <TextInput id="me-email" type="email" value={f.email} invalid={Boolean(errors.email)} onChange={(e) => setForm({ ...f, email: e.target.value })} />
      </Field>
      <Field label="Số điện thoại" htmlFor="me-phone" error={errors.phone}>
        <TextInput id="me-phone" inputMode="tel" value={f.phone} invalid={Boolean(errors.phone)} onChange={(e) => setForm({ ...f, phone: e.target.value })} />
      </Field>
      <p className="text-[12px] text-[var(--text-muted)]">Họ tên, vai trò, mức lương do quản lý cập nhật.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!form} loading={save.isPending} onClick={() => save.mutate(f)}>Lưu</Button>
        <Button variant="outline" leadingIcon={<KeyRound size={15} />} onClick={() => navigate('/doi-mat-khau')}>Đổi mật khẩu</Button>
      </div>
    </div>
  );
}
