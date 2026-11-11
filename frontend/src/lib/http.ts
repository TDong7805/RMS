import axios, { type AxiosError } from 'axios';
import { BusinessError, ValidationError } from '@/lib/mock';

/**
 * Client gọi backend Spring Boot. Khi chạy `npm run dev`, Vite proxy chuyển /api → http://localhost:8080
 * (đổi bằng biến BACKEND_PORT). Khi triển khai riêng, đặt VITE_API_BASE_URL trỏ tới máy chủ API.
 *
 * Đăng nhập bằng cookie phiên RMS_SESSION (HttpOnly) — trình duyệt tự gửi kèm, code không cần đụng tới.
 *
 * Quy ước lỗi của backend: {"message": "...", "fields": {...}}
 *  - 422 kèm fields → ValidationError (form hiển thị lỗi dưới từng ô nhập)
 *  - 401 (hết phiên / tài khoản bị khóa) → báo cho lib/auth để đưa về trang đăng nhập
 *  - lỗi khác       → BusinessError với thông báo và mã HTTP của máy chủ
 *  - không có phản hồi → lỗi mất kết nối
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 20_000,
  // Gửi cookie phiên cả khi frontend và backend khác cổng (không qua proxy).
  withCredentials: true,
});

type ErrorBody = { message?: string; fields?: Record<string, string> };

/** Các API tự xử lý 401 của mình (sai mật khẩu, kiểm tra đã đăng nhập chưa…), không coi là hết phiên. */
const SELF_HANDLED_401 = ['/api/auth/login', '/api/auth/me', '/api/auth/logout'];

let onUnauthorized: ((message: string) => void) | null = null;

/** lib/auth đăng ký hàm này để xóa phiên phía giao diện khi backend trả 401. */
export function setUnauthorizedHandler(handler: ((message: string) => void) | null): void {
  onUnauthorized = handler;
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    if (!error.response) {
      throw new BusinessError('Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.');
    }
    const { status, data } = error.response;
    const message = data?.message || 'Đã có lỗi xảy ra, vui lòng thử lại';
    if (status === 422 && data?.fields && Object.keys(data.fields).length > 0) {
      throw new ValidationError(data.fields, message);
    }
    const url = error.config?.url ?? '';
    if (status === 401 && !SELF_HANDLED_401.some((path) => url.startsWith(path))) {
      onUnauthorized?.(message);
    }
    throw new BusinessError(message, status);
  },
);

type Params = Record<string, string | number | boolean | undefined | null>;

export const api = {
  get: async <T>(url: string, params?: Params) => (await http.get<T>(url, { params })).data,
  post: async <T>(url: string, body?: unknown) => (await http.post<T>(url, body)).data,
  put: async <T>(url: string, body?: unknown) => (await http.put<T>(url, body)).data,
  patch: async <T>(url: string, body?: unknown) => (await http.patch<T>(url, body)).data,
  delete: async (url: string) => {
    await http.delete(url);
  },
};
