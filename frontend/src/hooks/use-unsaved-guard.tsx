import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '@/components/common/Modal';

/**
 * Hỏi trước khi rời trang khi còn thay đổi chưa lưu — bất kể rời bằng cách nào: nút Quay lại, menu trái, Ctrl+K,
 * đường dẫn trên cùng, nút Back của trình duyệt. Đóng tab / tải lại trang thì trình duyệt tự hỏi.
 * `watchSearch`: trang chia mục bằng ?tab= (vd. Cấu hình) — đổi mục cũng hỏi.
 *
 *   const guard = useUnsavedGuard(dirty);
 *   …onSuccess: () => { guard.allowLeave(); navigate('/…'); }
 *   return <>…{guard.dialog}</>;
 */
export function useUnsavedGuard(dirty: boolean, opts: { watchSearch?: boolean } = {}) {
  const { watchSearch = false } = opts;
  const allow = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allow.current &&
      (currentLocation.pathname !== nextLocation.pathname || (watchSearch && currentLocation.search !== nextLocation.search)),
  );

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (allow.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  /** Gọi ngay trước khi tự chuyển trang sau khi lưu thành công. */
  const allowLeave = useCallback(() => {
    allow.current = true;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(o) => {
        if (!o && blocker.state === 'blocked') blocker.reset();
      }}
      title="Bỏ các thay đổi chưa lưu?"
      description="Những gì bạn vừa sửa sẽ mất. Muốn giữ thì bấm Ở lại rồi bấm Lưu."
      cancelLabel="Ở lại"
      confirmLabel="Bỏ thay đổi"
      onConfirm={() => {
        if (blocker.state === 'blocked') blocker.proceed();
      }}
    />
  );

  return { dialog, allowLeave };
}
