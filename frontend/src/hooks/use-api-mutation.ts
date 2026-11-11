import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, isValidationError } from '@/lib/mock';

export interface ApiMutationOptions<TVars, TResult> {
  /** Các query cần tải lại sau khi thành công. */
  invalidate?: QueryKey[];
  /** Thông báo thành công (chuỗi hoặc hàm). Bỏ trống để không hiện. */
  success?: string | ((result: TResult, vars: TVars) => string);
  onSuccess?: (result: TResult, vars: TVars) => void;
  /** Nhận lỗi theo từng trường (ValidationError) để hiển thị ngay dưới ô nhập. */
  onFieldErrors?: (fields: Record<string, string>) => void;
}

/**
 * Bọc useMutation theo một quy ước chung cho các màn hình quản lý:
 * thành công → invalidate + toast; lỗi dữ liệu → trả lỗi theo trường và giữ nguyên dữ liệu đang nhập;
 * lỗi khác (mất kết nối, lỗi nghiệp vụ) → toast lỗi.
 */
export function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  options: ApiMutationOptions<TVars, TResult> = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      options.invalidate?.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
      if (options.success) {
        toast.success(typeof options.success === 'function' ? options.success(result, vars) : options.success);
      }
      options.onSuccess?.(result, vars);
    },
    onError: (error) => {
      if (isValidationError(error)) {
        options.onFieldErrors?.(error.fields);
        toast.error(error.message, {
          description: options.onFieldErrors ? 'Vui lòng kiểm tra các trường được đánh dấu.' : Object.values(error.fields)[0],
        });
        return;
      }
      toast.error(errorMessage(error));
    },
  });
}
