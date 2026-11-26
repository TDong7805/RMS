import { useEffect, useState } from 'react';
import { Hand } from 'lucide-react';

const KEY = 'fb-guide';

/**
 * Hướng dẫn thao tác lật sách (E1, nhóm chốt 27/11/2026): lần đầu mở sách trong phiên, một bàn tay nhỏ làm động tác
 * kéo góc trang sang trái kèm một dòng chữ. Không chặn thao tác (pointer-events: none); khách chạm / bấm / cuộn / gõ
 * phím bất kỳ hoặc sau 7 giây thì tự tắt. Chỉ hiện khi sách đang ở bìa (`atCover`).
 * Đặt chồng lên khung sách (.fb-stage) — không sửa code lật trang của PageFlipBook.
 */
export function FlipGuide({ atCover }: { atCover: boolean }) {
  const [show, setShow] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) !== '1';
    } catch {
      return true;
    }
  });
  const touch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

  useEffect(() => {
    if (!show) return;
    const done = () => {
      setShow(false);
      try {
        sessionStorage.setItem(KEY, '1');
      } catch {
        /* chế độ riêng tư */
      }
    };
    // Đợi sách vẽ xong mới bắt sự kiện, để cú bấm mở trang không tắt hướng dẫn ngay.
    const start = window.setTimeout(() => {
      window.addEventListener('pointerdown', done, { once: true });
      window.addEventListener('keydown', done, { once: true });
      window.addEventListener('wheel', done, { once: true, passive: true });
    }, 600);
    const auto = window.setTimeout(done, 7600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(auto);
      window.removeEventListener('pointerdown', done);
      window.removeEventListener('keydown', done);
      window.removeEventListener('wheel', done);
    };
  }, [show]);

  if (!show || !atCover) return null;
  return (
    <div className="fb-guide" role="note" aria-live="polite">
      <div className="fb-guide__track" aria-hidden>
        <span className="fb-guide__trail" />
        <Hand className="fb-guide__hand" size={34} strokeWidth={1.6} />
      </div>
      <p className="fb-guide__text">
        {touch ? 'Vuốt sang trái hoặc kéo góc trang để lật sách' : 'Kéo góc trang sang trái, hoặc bấm phím → để lật sách'}
      </p>
    </div>
  );
}
