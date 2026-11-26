import { api } from '@/lib/http';
import type { WebsiteContent, WebsiteContentInput, WebsiteFeature, WebsiteFeatureInput, WebsiteFeatureKind, WebsiteMenuCategory, WebsitePhoto, WebsitePhotoInput } from '@/types';

/* Cấu hình website khách hàng — chỉ Quản lý nhà hàng (Cấu hình hệ thống → tab Website khách hàng). */

export const getWebsiteContent = () => api.get<WebsiteContent>('/api/website/content');

export const updateWebsiteContent = (input: WebsiteContentInput) => api.put<WebsiteContent>('/api/website/content', input);

export const getWebsiteGallery = () => api.get<WebsitePhoto[]>('/api/website/gallery');

export const addWebsitePhoto = (input: WebsitePhotoInput) => api.post<WebsitePhoto>('/api/website/gallery', input);

export const updateWebsitePhoto = ({ id, ...input }: WebsitePhotoInput & { id: string }) =>
  api.put<WebsitePhoto>(`/api/website/gallery/${encodeURIComponent(id)}`, input);

/** Đổi chỗ với ảnh liền trước / sau → trả cả album theo thứ tự mới. */
export const moveWebsitePhoto = ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
  api.patch<WebsitePhoto[]>(`/api/website/gallery/${encodeURIComponent(id)}/move`, { direction });

export const deleteWebsitePhoto = (id: string) => api.delete(`/api/website/gallery/${encodeURIComponent(id)}`);

export const getWebsiteMenu = () => api.get<WebsiteMenuCategory[]>('/api/website/menu');

export const setWebsiteCategoryVisible = ({ id, visible }: { id: string; visible: boolean }) =>
  api.patch<WebsiteMenuCategory[]>(`/api/website/menu/categories/${encodeURIComponent(id)}`, { visible });

export const setWebsiteDishVisible = ({ id, visible }: { id: string; visible: boolean }) =>
  api.patch<WebsiteMenuCategory[]>(`/api/website/menu/dishes/${encodeURIComponent(id)}`, { visible });

/* Món đặc trưng / trải nghiệm trên trang chủ */

export const getWebsiteFeatures = (kind: WebsiteFeatureKind) => api.get<WebsiteFeature[]>('/api/website/features', { kind });

export const addWebsiteFeature = (input: WebsiteFeatureInput) => api.post<WebsiteFeature>('/api/website/features', input);

export const updateWebsiteFeature = ({ id, ...input }: WebsiteFeatureInput & { id: string }) =>
  api.put<WebsiteFeature>(`/api/website/features/${encodeURIComponent(id)}`, input);

/** Đổi chỗ với mục liền trước / sau cùng loại → trả cả danh sách loại đó theo thứ tự mới. */
export const moveWebsiteFeature = ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
  api.patch<WebsiteFeature[]>(`/api/website/features/${encodeURIComponent(id)}/move`, { direction });

export const deleteWebsiteFeature = (id: string) => api.delete(`/api/website/features/${encodeURIComponent(id)}`);
