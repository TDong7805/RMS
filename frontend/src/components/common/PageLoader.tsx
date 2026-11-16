/**
 * Màn hình chờ toàn trang: miệng tròn "ăn" các món (bò bít tết, hamburger, ly nước, khoai tây chiên) + dòng chữ.
 * Cùng giao diện với màn hình chờ viết sẵn trong index.html (hiện trước khi JavaScript tải xong) — CSS lớp .rl-* nằm ở đó,
 * nên lúc chuyển từ HTML sang React không bị nhảy hình. Chỉ hiện khi phải chờ quá 0,3 giây (tránh nháy khi tải nhanh).
 */
export const LOADER_TEXT = 'Chờ chút, món ngon sắp lên';

/** Bò bít tết */
const STEAK = (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="20" cy="27" rx="16" ry="6" /><path d="M9 23c0-5 6-9 12-9s10 3 10 6c0 4-6 7-11 7s-11 0-11-4Z" /><path d="M15 20c2 1 4 0 6 1M18 24c2-1 4 0 6-1" /><path d="M28 12c2-3 5-3 6-2-1 3-4 4-6 2Z" stroke="#8cc63f" /></svg>
);
/** Hamburger */
const BURGER = (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 18a12 9 0 0 1 24 0Z" /><path d="M16 13h.01M21 12h.01M25 14h.01" /><path d="M7 22c2 2 3 0 5 1s3 2 5 0 3-1 5 0 3 2 5 0 3-1 6 0" stroke="#8cc63f" /><rect x="8" y="25" width="24" height="3" rx="1.5" /><path d="M8 31h24a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z" /></svg>
);
/** Ly nước */
const DRINK = (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14h16l-2 20H14Z" /><path d="M10 14h20" /><path d="M21 14l3-9h4" /><path d="M13 23h14" stroke="#8cc63f" /></svg>
);
/** Khoai tây chiên */
const FRIES = (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 19V9M18 19V6M22 19V8M26 19V10" /><path d="M10 19h20l-3 15H13Z" /><circle cx="20" cy="26" r="2.5" stroke="#8cc63f" /></svg>
);
const ICONS = [STEAK, BURGER, DRINK, FRIES];

/** Đã quá 0,3 giây kể từ lúc mở trang → màn hình chờ của HTML đang hiện, hiện tiếp ngay (không mờ lại từ đầu). */
const shownAlready = () => typeof performance !== 'undefined' && performance.now() > 300;

export function PageLoader({ text = LOADER_TEXT }: { text?: string }) {
  return (
    <div className={shownAlready() ? 'rl rl-now' : 'rl'} role="status" aria-live="polite">
      <div className="rl-stage" aria-hidden="true">
        <div className="rl-mouth" />
        <div className="rl-window">
          <div className="rl-track">
            {[...ICONS, ...ICONS].map((icon, i) => (
              <span key={i} style={{ display: 'contents' }}>{icon}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="rl-text">
        <span>{text}</span>
        <span className="rl-dots" />
      </p>
    </div>
  );
}
