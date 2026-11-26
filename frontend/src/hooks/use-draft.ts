import { useCallback, useEffect, useState } from 'react';

/**
 * Bản nháp của một biểu mẫu nạp từ máy chủ: giữ bản gốc để biết "có thay đổi chưa lưu" và để "Hủy thay đổi".
 * Dữ liệu máy chủ đổi (vd. sau khi lưu) thì nạp lại — trừ khi đang có thay đổi chưa lưu.
 *
 *   const d = useDraft(query.data, (x) => ({ name: x.name }));
 *   d.draft · d.set({ name }) · d.dirty · d.reset() · d.commit(serverValue)
 */
export function useDraft<S, T>(source: S | undefined, toDraft: (s: S) => T) {
  const [initial, setInitial] = useState<T | null>(null);
  const [draft, setDraft] = useState<T | null>(null);
  const dirty = initial !== null && draft !== null && JSON.stringify(initial) !== JSON.stringify(draft);

  useEffect(() => {
    if (source === undefined || dirty) return;
    const next = toDraft(source);
    setInitial(next);
    setDraft(next);
    // Chỉ nạp lại khi dữ liệu máy chủ đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const set = useCallback((patch: Partial<T>) => setDraft((d) => (d ? { ...d, ...patch } : d)), []);
  const reset = useCallback(() => setDraft(initial), [initial]);
  /** Sau khi lưu thành công: lấy giá trị máy chủ trả về làm bản gốc mới. */
  const commit = useCallback((s: S) => {
    const next = toDraft(s);
    setInitial(next);
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { draft, setDraft, set, dirty, reset, commit };
}
