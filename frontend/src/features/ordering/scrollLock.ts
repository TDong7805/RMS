/**
 * Khóa cuộn trang nền khi mở màn hình / tấm trượt phủ lên thực đơn.
 * Chỉ đặt `overflow: hidden` cho body thì Safari (iPhone) và nhiều trình duyệt điện thoại vẫn cho cú kéo "lọt" xuống
 * thực đơn bên dưới → cố định body tại vị trí đang cuộn, mở khóa thì trả lại đúng chỗ. Đếm số lớp đang mở để
 * màn chồng màn (vd. chi tiết món mở từ giỏ) không mở khóa sớm.
 */
let depth = 0;
let saved: { y: number; style: string } | null = null;
/** Vị trí vừa trả lại: khóa lại ngay sau đó (React chạy hiệu ứng 2 lần ở chế độ dev, màn nối màn) thì trình duyệt
 * có thể chưa kịp cuộn xong → dùng lại vị trí này thay vì đọc scrollY (lúc đó còn là 0). */
let lastRestore = { y: 0, t: -1 };

export function lockScroll(): () => void {
  if (depth === 0) {
    const y = performance.now() - lastRestore.t < 120 ? lastRestore.y : window.scrollY;
    saved = { y, style: document.body.getAttribute('style') ?? '' };
    Object.assign(document.body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden' });
  }
  depth++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    depth = Math.max(0, depth - 1);
    if (depth === 0 && saved) {
      const { y, style } = saved;
      saved = null;
      if (style) document.body.setAttribute('style', style);
      else document.body.removeAttribute('style');
      window.scrollTo(0, y);
      lastRestore = { y, t: performance.now() };
    }
  };
}
