import axios, { type AxiosError } from 'axios';
import { BusinessError, ValidationError } from '@/lib/mock';

/**
 * Client gọi backend Spring Boot. Khi chạy `npm run dev`, Vite proxy chuyển /api → http://localhost:8080
 * (đổi bằng biến BACKEND_PORT). Khi triển khai riêng, đặt VITE_API_BASE_URL trỏ tới máy chủ API.
 *
 * Quy ước lỗi của backend: {"message": "...", "fields": {...}}
 *  - 422 kèm fields → ValidationError (form hiển thị lỗi dưới từng ô nhập)
 *  - lỗi khác       → BusinessError với thông báo của máy chủ
 *  - không có phản hồi → lỗi mất kết nối
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  timeout: 20_000,
});

type ErrorBody = { message?: string; fields?: Record<string, string> };

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
    throw new BusinessError(message);
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
