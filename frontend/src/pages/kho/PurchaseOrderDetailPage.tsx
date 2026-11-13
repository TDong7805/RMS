import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, PackageCheck, Pencil, StopCircle, Trash2, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { BlockError } from '@/components/common/EmptyState';
import { DataTable, PageHeader, StatTile, Td, Th } from '@/components/common/PageParts';
import { Skeleton } from '@/components/common/Skeleton';
import { PurchaseCancelDialog, PurchaseCloseDialog, PurchaseDeleteDialog, type PurchaseTarget } from '@/features/warehouse/PurchaseDialogs';
import { CancelPaymentDialog, PaymentDialog, type PayableOrder } from '@/features/warehouse/PaymentDialogs';
import { usePurchaseOrder } from '@/features/warehouse/queries';
import {
  formatQty,
  formatSpec,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  PURCHASE_CANCEL_REASON,
  PURCHASE_CLOSE_REASON,
  PURCHASE_EVENT,
  purchaseStatusLabel,
} from '@/features/warehouse/labels';
import { InfoItem } from '@/features/warehouse/parts';
import { formatCurrency } from '@/lib/format';
import { formatDateOnly, formatDateTime } from '@/lib/labels';
import type { PurchaseCancelReason, PurchaseCloseReason, PurchaseOrderDetail, SupplierPayment } from '@/types';

function reasonLabel(event: string, reason: string | null): string {
  if (!reason) return '';
  if (event === 'cancel') return PURCHASE_CANCEL_REASON[reason as PurchaseCancelReason] ?? reason;
  if (event === 'close') return PURCHASE_CLOSE_REASON[reason as PurchaseCloseReason] ?? reason;
  return reason;
}

/** UC-KHO-14: Xem chi tiết phiếu mua (chỉ đọc; thao tác theo trạng thái). */
export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detail = usePurchaseOrder(id);
  const po = detail.data;
  const [cancelTarget, setCancelTarget] = useState<PurchaseTarget | null>(null);
  const [closeTarget, setCloseTarget] = useState<PurchaseTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseTarget | null>(null);
  const [payOrders, setPayOrders] = useState<PayableOrder[] | null>(null);
  const [cancelPay, setCancelPay] = useState<SupplierPayment | null>(null);

  const target = (p: PurchaseOrderDetail): PurchaseTarget => {
    const done = p.lines.filter((l) => l.qtyOrdered !== null && l.qtyReceived >= l.qtyOrdered).length;
    return { id: p.id, code: p.code, supplierName: p.supplier.name, payable: p.payable, progress: `${done}/${p.lines.length}` };
  };

  return (
    <AppShell meta={{ label: po ? po.code : 'Chi tiết phiếu mua', parent: 'Quản lý phiếu mua' }}>
      <div className="min-w-0 space-y-4">
        {detail.isError ? (
          <>
            <PageHeader title="Chi tiết phiếu mua" />
            <BlockError message="Không tìm thấy phiếu mua" onRetry={() => navigate('/kho/phieu-mua')} />
          </>
        ) : !po ? (
          <div className="space-y-4">
            <Skeleton className="h-16" />
            <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-64" />
          </div>
        ) : (
          <Body
            po={po}
            navigate={navigate}
            onCancel={() => setCancelTarget(target(po))}
            onClose={() => setCloseTarget(target(po))}
            onDelete={() => setDeleteTarget(target(po))}
            onPay={() => setPayOrders([{ id: po.id, code: po.code, supplierName: po.supplier.name, payable: po.payable, paid: po.paid, debt: po.debt }])}
            onCancelPayment={(p) => setCancelPay({ ...p, purchaseOrderId: po.id, purchaseOrderCode: po.code, reference: '', note: '', cancelReason: null })}
          />
        )}
      </div>
      <PurchaseCancelDialog target={cancelTarget} onClose={() => setCancelTarget(null)} />
      <PurchaseCloseDialog target={closeTarget} onClose={() => setCloseTarget(null)} />
      <PurchaseDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDone={() => navigate('/kho/phieu-mua')} />
      <PaymentDialog open={Boolean(payOrders)} onClose={() => setPayOrders(null)} orders={payOrders ?? []} defaultMethod={po?.supplier.paymentMethod} />
      <CancelPaymentDialog payment={cancelPay} onClose={() => setCancelPay(null)} />
    </AppShell>
  );
}

function Body({
  po,
  navigate,
  onCancel,
  onClose,
  onDelete,
  onPay,
  onCancelPayment,
}: {
  po: PurchaseOrderDetail;
  navigate: ReturnType<typeof useNavigate>;
  onCancel: () => void;
  onClose: () => void;
  onDelete: () => void;
  onPay: () => void;
  onCancelPayment: (p: PurchaseOrderDetail['payments'][number]) => void;
}) {
  const st = purchaseStatusLabel(po.status, po.receiveStatus);
  const waiting = po.status === 'ordered' && (po.receiveStatus === 'not_received' || po.receiveStatus === 'partial');

  return (
    <>
      <PageHeader
        title={`${po.code} · ${po.name}`}
        description={`Tạo bởi ${po.createdBy || '—'} lúc ${formatDateTime(po.createdAt)}${po.orderedAt ? ` · đặt hàng bởi ${po.orderedBy ?? '—'} lúc ${formatDateTime(po.orderedAt)}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />} onClick={() => navigate('/kho/phieu-mua')}>Về danh sách</Button>
            {po.status === 'draft' ? (
              <>
                <Button variant="outline" size="sm" leadingIcon={<Pencil size={15} />} onClick={() => navigate(`/kho/phieu-mua/${po.id}/sua`)}>Sửa</Button>
                <Button variant="danger" size="sm" leadingIcon={<Trash2 size={15} />} onClick={onDelete}>Xóa phiếu</Button>
              </>
            ) : null}
            {waiting ? <Button size="sm" leadingIcon={<PackageCheck size={15} />} onClick={() => navigate(`/kho/phieu-mua/${po.id}/nhan-hang`)}>Nhận hàng</Button> : null}
            {po.status === 'ordered' && po.receiveStatus === 'not_received' ? (
              <Button variant="outline" size="sm" leadingIcon={<Ban size={15} />} onClick={onCancel}>Hủy phiếu</Button>
            ) : null}
            {po.status === 'ordered' && po.receiveStatus === 'partial' ? (
              <Button variant="outline" size="sm" leadingIcon={<StopCircle size={15} />} onClick={onClose}>Kết thúc nhận hàng</Button>
            ) : null}
            {po.status === 'ordered' && po.debt > 0 ? <Button variant="outline" size="sm" leadingIcon={<Wallet size={15} />} onClick={onPay}>Thanh toán</Button> : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Trạng thái" value={<span className="font-sans text-[18px]"><Badge variant={st.variant}>{st.label}</Badge>{po.late ? <> <Badge variant="danger">Trễ hạn</Badge></> : null}</span>} hint={po.status === 'ordered' ? 'Đã đặt hàng' : undefined} />
        <StatTile label="Tổng cộng" value={formatCurrency(po.total)} />
        <StatTile label="Phải trả (theo hàng đã nhận)" value={formatCurrency(po.payable)} hint={po.status === 'ordered' ? `Đã trả ${formatCurrency(po.paid)}` : 'Chưa phát sinh công nợ'} />
        <StatTile
          label="Còn nợ"
          value={formatCurrency(po.debt)}
          tone={po.debt > 0 ? 'warning' : 'default'}
          hint={po.paymentStatus ? PAYMENT_STATUS[po.paymentStatus].label : '—'}
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card padded>
          <CardHeader title="Thông tin phiếu" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <InfoItem label="Nhà cung cấp">
              <Link to={`/kho/nha-cung-cap/${po.supplier.id}`} className="font-semibold hover:text-[var(--accent)]">{po.supplier.name}</Link>
              {!po.supplier.active ? <> <Badge variant="neutral">Ngừng hoạt động</Badge></> : null}
            </InfoItem>
            <InfoItem label="Số điện thoại"><span className="font-mono">{po.supplier.phone}</span></InfoItem>
            <InfoItem label="Thanh toán">{PAYMENT_METHOD[po.supplier.paymentMethod]}</InfoItem>
            <InfoItem label="Ngày đặt">{po.orderDate ? formatDateOnly(po.orderDate) : '—'}</InfoItem>
            <InfoItem label="Ngày dự kiến nhận">{po.expectedDate ? formatDateOnly(po.expectedDate) : '—'}</InfoItem>
            <InfoItem label="Số nguyên liệu">{po.lines.length}</InfoItem>
            <div className="sm:col-span-3"><InfoItem label="Ghi chú">{po.note || '—'}</InfoItem></div>
          </div>
        </Card>
        <Card padded>
          <CardHeader title="Lịch sử trạng thái" />
          <ol className="mt-3 space-y-3">
            {po.events.map((e) => (
              <li key={e.id} className="border-l-2 border-[var(--border)] pl-3">
                <p className="text-[13.5px] font-semibold">{PURCHASE_EVENT[e.event]}</p>
                {e.reason ? <p className="text-[13px]">{reasonLabel(e.event, e.reason)}{e.note ? ` — ${e.note}` : ''}</p> : null}
                <p className="text-[12px] text-[var(--text-muted)]">{e.by} · {formatDateTime(e.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 pb-3"><CardHeader title="Nguyên liệu" /></div>
        <DataTable minWidth={1040}>
          <thead>
            <tr>
              <Th>Nguyên liệu</Th>
              <Th>Quy cách</Th>
              <Th className="text-right">SL đặt</Th>
              <Th className="text-right">Đã nhận</Th>
              <Th className="text-right">Còn lại</Th>
              <Th className="text-right">Đơn giá</Th>
              <Th className="text-right">Thành tiền</Th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => {
              const remaining = l.qtyOrdered === null ? null : Math.max(0, Math.round((l.qtyOrdered - l.qtyReceived) * 1000) / 1000);
              return (
                <tr key={l.id}>
                  <Td>
                    <Link to={`/kho/nguyen-lieu/${l.ingredientId}`} className="font-semibold hover:text-[var(--accent)]">{l.ingredientName}</Link>
                    <p className="font-mono text-[12px] text-[var(--text-muted)]">{l.ingredientCode}</p>
                  </Td>
                  <Td className="text-[13px]">{formatSpec(l.purchaseUnit, l.factor, l.stockUnit)}</Td>
                  <Td className="text-right font-mono">{l.qtyOrdered === null ? '—' : formatQty(l.qtyOrdered, l.purchaseUnit)}</Td>
                  <Td className="text-right font-mono">{formatQty(l.qtyReceived, l.purchaseUnit)}</Td>
                  <Td className="text-right font-mono">
                    {remaining === null ? '—' : formatQty(remaining, l.purchaseUnit)}
                    {remaining && l.factor !== 1 ? <p className="text-[12px] text-[var(--text-muted)]">= {formatQty(Math.round(remaining * l.factor * 1000) / 1000, l.stockUnit)}</p> : null}
                  </Td>
                  <Td className="text-right font-mono">{l.unitPrice === null ? '—' : formatCurrency(l.unitPrice)}</Td>
                  <Td className="text-right font-mono font-semibold">{formatCurrency(l.amount)}</Td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        <div className="flex justify-end border-t border-[var(--border)] p-5">
          <dl className="w-full max-w-[340px] space-y-1.5 text-[14px]">
            <Row label="Tạm tính" value={formatCurrency(po.subtotal)} />
            <Row label={`Giảm giá${po.discountPercent !== null ? ` (${po.discountPercent}%)` : ''}`} value={po.discount ? `− ${formatCurrency(po.discount)}` : formatCurrency(0)} />
            <Row label={`Thuế (${po.taxPercent}%)`} value={formatCurrency(po.tax)} />
            <Row label="Chi phí khác" value={formatCurrency(po.otherCost)} />
            <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
              <dt>Tổng cộng</dt>
              <dd className="font-mono text-[var(--accent)]">{formatCurrency(po.total)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="p-5 pb-3"><CardHeader title="Lịch sử nhận hàng" /></div>
          {po.receipts.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa nhận hàng lần nào.</p>
          ) : (
            <DataTable minWidth={520}>
              <thead><tr><Th>Phiếu nhập</Th><Th>Thời điểm</Th><Th>Người nhận</Th><Th className="text-right">Giá trị</Th><Th>Trạng thái</Th></tr></thead>
              <tbody>
                {po.receipts.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap"><Link to={`/kho/nhap-kho/${r.id}`} className="font-mono text-[12.5px] font-semibold hover:text-[var(--accent)]">{r.code}</Link></Td>
                    <Td className="whitespace-nowrap text-[13px]">{formatDateTime(r.at)}</Td>
                    <Td className="text-[13px]">{r.by}</Td>
                    <Td className="whitespace-nowrap text-right font-mono">{formatCurrency(r.value)}</Td>
                    <Td><Badge variant={r.status === 'posted' ? 'accent' : 'danger'}>{r.status === 'posted' ? 'Đã ghi sổ' : 'Đã hủy'}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="p-5 pb-3"><CardHeader title="Lịch sử thanh toán" /></div>
          {po.payments.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-[var(--text-muted)]">Chưa có thanh toán.</p>
          ) : (
            <DataTable minWidth={520}>
              <thead><tr><Th>Mã</Th><Th>Ngày</Th><Th className="text-right">Số tiền</Th><Th>Phương thức</Th><Th>Trạng thái</Th><Th><span className="sr-only">Hủy</span></Th></tr></thead>
              <tbody>
                {po.payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-mono text-[12.5px]">{p.code || '—'}</Td>
                    <Td className="text-[13px]">{formatDateTime(p.paidAt)}</Td>
                    <Td className="text-right font-mono">{formatCurrency(p.amount)}</Td>
                    <Td>{PAYMENT_METHOD[p.method]}</Td>
                    <Td><Badge variant={p.status === 'valid' ? 'accent' : 'neutral'}>{p.status === 'valid' ? 'Hiệu lực' : 'Đã hủy'}</Badge></Td>
                    <Td className="text-right">{p.status === 'valid' ? <Button size="sm" variant="ghost" aria-label={`Hủy thanh toán ${p.code}`} onClick={() => onCancelPayment(p)}><Ban size={14} /></Button> : null}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--text-secondary)]">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

export default PurchaseOrderDetailPage;
