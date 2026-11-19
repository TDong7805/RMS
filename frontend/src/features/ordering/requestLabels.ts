/* Nhãn loại yêu cầu / hình thức thanh toán của khách — dùng chung cho trang khách (QR) và trang thu ngân.
   Để riêng file nhẹ này để trang thu ngân không kéo theo thư viện chuyển động của trang khách. */

export const REQUEST_TYPE_LABEL: Record<string, string> = { support: 'Hỗ trợ tại bàn', consult: 'Tư vấn món', other: 'Khác', payment: 'Thanh toán' };
export const METHOD_LABEL: Record<string, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', ewallet: 'Ví điện tử' };
