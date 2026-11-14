import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Nghe kênh sự kiện (SSE) của máy chủ: có thay đổi thì tải lại các query được chỉ định.
 * Trình duyệt tự nối lại khi mất kết nối; các query vẫn tự làm mới định kỳ làm dự phòng.
 * onChange (tùy chọn): gọi thêm mỗi khi có sự kiện, ví dụ phát âm báo ở màn hình bếp.
 */
export function useLiveEvents(url: string | null, keys: QueryKey[], onChange?: () => void): { connected: boolean } {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const keysRef = useRef(keys);
  const changeRef = useRef(onChange);
  keysRef.current = keys;
  changeRef.current = onChange;

  useEffect(() => {
    if (!url || typeof EventSource === 'undefined') return;
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const source = new EventSource(base + url, { withCredentials: true });
    source.addEventListener('ready', () => setConnected(true));
    source.addEventListener('change', () => {
      keysRef.current.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      changeRef.current?.();
    });
    source.onerror = () => setConnected(false);
    return () => {
      source.close();
      setConnected(false);
    };
  }, [url, qc]);

  return { connected };
}

/** Âm báo ngắn tạo bằng Web Audio (không cần file âm thanh). Trình duyệt chỉ cho phát sau khi người dùng chạm trang. */
let audioCtx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

export function beep(times = 2): void {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const ctx = audioCtx;
  for (let i = 0; i < times; i++) {
    const start = ctx.currentTime + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i % 2 === 0 ? 880 : 1175;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}
