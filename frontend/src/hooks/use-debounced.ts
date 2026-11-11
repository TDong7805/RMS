import { useEffect, useState } from 'react';

/** Trả về giá trị sau khi người dùng ngừng thay đổi `ms` mili giây (dùng cho ô tìm kiếm). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
