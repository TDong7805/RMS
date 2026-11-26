import { api } from '@/lib/http';
import type {
  BankAccount,
  CashierCancelReason,
  CashierFloor,
  CashierOrderDetail,
  Invoice,
  InvoiceList,
  InvoicePreview,
  InvoiceStatus,
  KitchenCancelReason,
  KitchenQueue,
  MoveTarget,
  OrderList,
  OrderListStatus,
  OrderView,
  PaymentLineInput,
  PayMethod,
  QrMenu,
  QrTableInfo,
  RequestList,
  ServiceRequest,
  SoldOutDish,
} from '@/types';

/* ---------------------------------------------------------------- Trang đặt món (công khai, nhận diện bàn bằng mã QR) */

const qr = (token: string) => `/api/public/qr/${encodeURIComponent(token)}`;

/** UC-KH-01: thông tin bàn, nhà hàng, đang trong giờ phục vụ, đơn đang mở của bàn. */
export function getQrTable(token: string): Promise<QrTableInfo> {
  return api.get<QrTableInfo>(qr(token));
}

/** UC-KH-02: món đang bán (cờ soldOut = tạm hết hôm nay). */
export function getQrMenu(token: string): Promise<QrMenu> {
  return api.get<QrMenu>(`${qr(token)}/menu`);
}

export async function getQrOrder(token: string): Promise<OrderView | null> {
  return (await api.get<{ order: OrderView | null }>(`${qr(token)}/order`)).order;
}

/** UC-KH-03: gửi giỏ món (tất cả hoặc không gì). */
/** Dòng gửi: món lẻ (dishId) hoặc set (setId + parts — món con đã chọn loại / ghi chú). */
export type SendLine = { dishId?: string; qty: number; note?: string; setId?: string; parts?: { dishId: string; qty: number; note: string }[] };

export function sendQrOrder(token: string, items: SendLine[]): Promise<OrderView> {
  return api.post<OrderView>(`${qr(token)}/orders`, { items });
}

/** UC-KH-04: hủy món còn Chờ chế biến. */
export function cancelQrItem(token: string, itemId: string): Promise<OrderView> {
  return api.post<OrderView>(`${qr(token)}/items/${encodeURIComponent(itemId)}/cancel`);
}

/** UC-KH-05: gọi nhân viên. */
export function callStaff(token: string, type: 'support' | 'consult' | 'other', content: string): Promise<QrTableInfo> {
  return api.post<QrTableInfo>(`${qr(token)}/requests`, { type, content });
}

/** UC-KH-06: yêu cầu thanh toán. */
export function requestPayment(
  token: string,
  body: { method: 'cash' | 'card' | 'transfer'; vatCompany: string; vatTaxCode: string },
): Promise<QrTableInfo> {
  return api.post<QrTableInfo>(`${qr(token)}/payment-request`, body);
}

export function cancelQrRequest(token: string, requestId: string): Promise<QrTableInfo> {
  return api.post<QrTableInfo>(`${qr(token)}/requests/${encodeURIComponent(requestId)}/cancel`);
}

export const qrStreamUrl = (token: string) => `${qr(token)}/stream`;

/* ---------------------------------------------------------------- Bếp */

export function getKitchenQueue(): Promise<KitchenQueue> {
  return api.get<KitchenQueue>('/api/bep/queue');
}

export function startItems(ids: string[]): Promise<KitchenQueue> {
  return api.post<KitchenQueue>('/api/bep/items/start', { ids });
}

export function completeItems(ids: string[]): Promise<KitchenQueue> {
  return api.post<KitchenQueue>('/api/bep/items/complete', { ids });
}

/** Nhân viên phục vụ đã lấy món ở quầy bếp: Đã xong → Đã mang ra. */
export function kitchenServeItems(ids: string[]): Promise<KitchenQueue> {
  return api.post<KitchenQueue>('/api/bep/items/serve', { ids });
}

export function undoItem(id: string): Promise<KitchenQueue> {
  return api.post<KitchenQueue>(`/api/bep/items/${encodeURIComponent(id)}/undo`);
}

export function kitchenCancelItem(id: string, reason: KitchenCancelReason, note: string, markSoldOut: boolean): Promise<KitchenQueue> {
  return api.post<KitchenQueue>(`/api/bep/items/${encodeURIComponent(id)}/cancel`, { reason, note, markSoldOut });
}

export function getKitchenOrder(orderId: string): Promise<OrderView> {
  return api.get<OrderView>(`/api/bep/orders/${encodeURIComponent(orderId)}`);
}

export function getSoldOutDishes(): Promise<SoldOutDish[]> {
  return api.get<SoldOutDish[]>('/api/bep/dishes');
}

export function setDishSoldOut(dishId: string, soldOut: boolean): Promise<SoldOutDish> {
  return api.patch<SoldOutDish>(`/api/bep/dishes/${encodeURIComponent(dishId)}/sold-out`, { soldOut });
}

export const KITCHEN_STREAM = '/api/bep/stream';

/* ---------------------------------------------------------------- Thu ngân */

export function getCashierFloor(): Promise<CashierFloor> {
  return api.get<CashierFloor>('/api/thu-ngan/floor');
}

const tn = (path: string) => `/api/thu-ngan/${path}`;
const enc = encodeURIComponent;

export function getCashierOrder(id: string): Promise<CashierOrderDetail> {
  return api.get<CashierOrderDetail>(tn(`orders/${enc(id)}`));
}

/** UC-TN-02: tra cứu đơn (tối đa 31 ngày). */
export function getCashierOrders(params: { keyword?: string; status?: OrderListStatus; from?: string; to?: string }): Promise<OrderList> {
  return api.get<OrderList>(tn('orders'), params);
}

/** UC-TN-04 */
export function cashierCancelItem(itemId: string, reason: CashierCancelReason, note: string): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`items/${enc(itemId)}/cancel`), { reason, note });
}

export function cashierCancelOrder(orderId: string, reason: CashierCancelReason, note: string): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`orders/${enc(orderId)}/cancel`), { reason, note });
}

/** UC-TN-05 */
export function getMoveTargets(): Promise<MoveTarget[]> {
  return api.get<MoveTarget[]>(tn('move-targets'));
}

/** Sơ đồ bàn: số khách đang ngồi ở bàn (null = xóa). */
/** Mở bàn: tạo đơn rỗng cho bàn — từ lúc này mã QR của bàn mới gửi được món. */
export function openTable(tableId: string, guests: number | null, reservationId?: string): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`tables/${enc(tableId)}/open`), { guests, reservationId: reservationId ?? null });
}

/** Đóng bàn chưa gọi món (khách bỏ về / mở nhầm). */
export function closeTable(orderId: string): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`orders/${enc(orderId)}/close`));
}

/**
 * Cấu hình hệ thống → Gọi món tại bàn: tự đóng bàn mở quá N phút chưa gọi món (0 = tắt); món khách gửi phải được phục vụ
 * xác nhận rồi mới xuống bếp (V22); chờ xác nhận quá N phút thì nhắc lại cho mọi phục vụ đã vào ca.
 */
export interface OrderingSettings {
  openTableTimeoutMinutes: number;
  requireConfirm: boolean;
  confirmRemindMinutes: number;
}

export function getOrderingSettings(): Promise<OrderingSettings> {
  return api.get<OrderingSettings>('/api/settings/ordering');
}

export function saveOrderingSettings(s: OrderingSettings): Promise<OrderingSettings> {
  return api.put<OrderingSettings>('/api/settings/ordering', s);
}

export function setOrderGuests(orderId: string, guests: number | null): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`orders/${enc(orderId)}/guests`), { guests });
}

export function moveOrder(orderId: string, tableId: string): Promise<CashierOrderDetail> {
  return api.post<CashierOrderDetail>(tn(`orders/${enc(orderId)}/move`), { tableId });
}

/** UC-TN-07 */
export function getInvoicePreview(orderId: string): Promise<InvoicePreview> {
  return api.get<InvoicePreview>(tn(`orders/${enc(orderId)}/invoice-preview`));
}

export function createInvoice(orderId: string, vatCompany: string, vatTaxCode: string): Promise<Invoice> {
  return api.post<Invoice>(tn(`orders/${enc(orderId)}/invoice`), { vatCompany, vatTaxCode });
}

/** UC-TN-08, UC-TN-09 */
export function getInvoices(params: {
  keyword?: string;
  status?: InvoiceStatus | '';
  method?: PayMethod | '';
  from?: string;
  to?: string;
}): Promise<InvoiceList> {
  return api.get<InvoiceList>(tn('invoices'), params);
}

export function getInvoice(id: string): Promise<Invoice> {
  return api.get<Invoice>(tn(`invoices/${enc(id)}`));
}

export function payInvoice(id: string, payments: PaymentLineInput[]): Promise<Invoice> {
  return api.post<Invoice>(tn(`invoices/${enc(id)}/pay`), { payments });
}

export function cancelInvoice(id: string, reason: string): Promise<Invoice> {
  return api.post<Invoice>(tn(`invoices/${enc(id)}/cancel`), { reason });
}

/** UC-TN-06: yêu cầu thanh toán (từ V20 yêu cầu hỗ trợ do Nhân viên phục vụ xử lý — api/waiter.ts). */
export function getRequests(status: 'waiting' | 'done' | 'cancelled'): Promise<RequestList> {
  return api.get<RequestList>(tn('requests'), { status });
}

export function cancelRequest(id: string): Promise<ServiceRequest> {
  return api.post<ServiceRequest>(tn(`requests/${enc(id)}/cancel`));
}

/* ---------------------------------------------------------------- Quản lý: tài khoản nhận tiền */

export function getBankAccount(): Promise<BankAccount> {
  return api.get<BankAccount>('/api/settings/payment');
}

export function saveBankAccount(body: Omit<BankAccount, 'configured'>): Promise<BankAccount> {
  return api.put<BankAccount>('/api/settings/payment', body);
}

export const CASHIER_STREAM = '/api/thu-ngan/stream';

/* ---------------------------------------------------------------- Trợ lý gọi món (trang QR, dựa trên luật) */

export type AssistantSuggestion = { kind: 'dish' | 'set'; id: string; qty: number; note: string | null };
export type AssistantReply = { text: string; items: AssistantSuggestion[]; chips: string[]; addAll: boolean; source?: 'ai' | 'rules' };

/** history: các câu khách hỏi trước (cũ → mới); shown: id món đã gợi ý; cart: id món trong giỏ. */
export function askAssistant(
  token: string,
  body: { message: string; history: string[]; shown: string[]; cart: string[]; sessionId?: string },
): Promise<AssistantReply> {
  return api.post<AssistantReply>(`${qr(token)}/assistant`, body);
}

export type AssistantIntro = { active: boolean; botName: string; avatar: string; greeting: string; chips: string[] };

/** Tên, ảnh đại diện, lời chào, câu gợi ý nhanh của trợ lý (Quản lý Chatbot); active = false → ẩn trợ lý. */
export function getAssistantIntro(token: string): Promise<AssistantIntro> {
  return api.get<AssistantIntro>(`${qr(token)}/assistant`);
}

/** Khách bấm "Thêm" trên thẻ gợi ý của trợ lý → thống kê "khách thêm món nhờ chatbot" (Quản lý Chatbot). */
export function reportAssistantAdds(token: string, sessionId: string, items: { kind: 'dish' | 'set'; id: string; qty: number }[]) {
  return api.post<{ saved: number }>(`${qr(token)}/assistant/added`, { sessionId, items });
}

/* ---------------------------------------------------------------- Thu ngân: đặt bàn (B6 — thu ngân nhận đặt bàn tại quầy) */

export type CashierReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

/** Một lịch đặt trong ngày trên màn POS. */
export interface CashierReservation {
  id: string;
  code: string;
  customerName: string;
  phone: string;
  guests: number;
  dateTime: string;
  areaId: string;
  areaName: string;
  tableId: string | null;
  tableCode: string | null;
  note: string;
  status: CashierReservationStatus;
  source: 'website' | 'phone' | 'walk_in';
}

export interface CashierReservationInput {
  customerName: string;
  phone: string;
  guests: number | null;
  date: string;
  time: string;
  areaId: string;
  tableId: string;
  note: string;
}

export const CASHIER_RES_KEY = (date: string) => ['thu-ngan', 'reservations', date] as const;
export const getCashierReservations = (date: string) => api.get<CashierReservation[]>(tn('reservations'), { date });
export const createCashierReservation = (input: CashierReservationInput & { source: 'phone' | 'walk_in' }) => api.post<{ id: string; code: string }>(tn('reservations'), input);
export const updateCashierReservation = (id: string, input: CashierReservationInput) => api.put<{ id: string; code: string }>(tn(`reservations/${enc(id)}`), input);
export const setCashierReservationStatus = (id: string, status: 'confirmed' | 'cancelled' | 'no_show') =>
  api.patch<{ id: string }>(tn(`reservations/${enc(id)}/status`), { status });
