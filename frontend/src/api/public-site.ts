import { api } from '@/lib/http';
import type {
  GalleryPhoto, PublicMenu, PublicMenuFilter, PublicReservationInput, PublicReservationResult, PublicSite,
  SiteAssistantIntro, SiteAssistantQuestion, SiteAssistantReply,
} from '@/types';

/**
 * Website khách hàng — API công khai (/api/public/**, không cần đăng nhập).
 * Mọi nội dung do Quản lý nhà hàng cấu hình ở Cấu hình hệ thống (thông tin nhà hàng + tab Website khách hàng).
 */

/** Thương hiệu, giới thiệu, liên hệ, giờ mở cửa, cấu hình form đặt bàn, khu vực cho chọn. */
export const getPublicSite = () => api.get<PublicSite>('/api/public/site');

/** Thực đơn hiện trên website; tìm không dấu theo tên / mô tả / loại / danh mục. */
export const getPublicMenu = (f: PublicMenuFilter) => api.get<PublicMenu>('/api/public/site/menu', { ...f });

export const getPublicGallery = () => api.get<GalleryPhoto[]>('/api/public/site/gallery');

/** Lỗi 422 theo trường (customerName, phone, email, guests, date, time, areaId, note); 409 trùng lịch; 429 gửi quá nhiều. */
export const createPublicReservation = (input: PublicReservationInput) =>
  api.post<PublicReservationResult>('/api/public/reservations', input);

/** Chatbot tư vấn trên website: bật/tắt, tên, ảnh đại diện, lời chào, câu gợi ý. */
export const getSiteAssistant = () => api.get<SiteAssistantIntro>('/api/public/site/assistant');

/** 409 khi chatbot đang tắt trên website. */
export const askSiteAssistant = (q: SiteAssistantQuestion) => api.post<SiteAssistantReply>('/api/public/site/assistant', q);
