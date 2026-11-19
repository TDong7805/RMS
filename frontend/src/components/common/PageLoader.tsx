/**
 * Màn hình chờ toàn trang: thớt gỗ, miếng steak chín dần từ trái sang (thanh "độ chín"), dao nĩa vàng đồng, hương thảo,
 * tiêu muối, khói bốc + dòng chữ. Cùng hình vẽ với màn hình chờ viết sẵn trong index.html (hiện trước khi JavaScript tải xong);
 * CSS lớp .rl-* nằm ở index.html, nên lúc chuyển từ HTML sang React không bị nhảy hình. Sửa hình thì sửa cả hai chỗ.
 * Chỉ hiện khi phải chờ quá 0,3 giây (tránh nháy khi tải nhanh).
 */
export const LOADER_TEXT = 'Chờ chút, món ngon sắp lên';

/** Giống hệt thẻ <svg class="rl-art"> trong index.html. */
const ART = '<svg class="rl-art" viewBox="0 0 320 176" aria-hidden="true"><defs><clipPath id="rl-steak"><path d="M80 108c2-12 18-19 42-18 20 1 34-4 58-3 28 1 56 3 62 17 5 12-1 24-20 29-22 5-44 0-68 2-26 2-52 7-66-3-9-6-10-15-8-24z"/></clipPath><linearGradient id="rl-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="rl-wood-a"/><stop offset="1" class="rl-wood-b"/></linearGradient></defs><ellipse cx="160" cy="160" rx="132" ry="9" class="rl-shadow"/><rect x="34" y="74" width="232" height="80" rx="24" fill="url(#rl-wood)" class="rl-board"/><rect x="258" y="100" width="40" height="28" rx="14" fill="url(#rl-wood)" class="rl-board"/><circle cx="285" cy="114" r="5" class="rl-hole"/><path d="M52 92c40-6 80 4 120-2s60-4 80 2M48 136c50 5 90-4 140 1s50 2 64-2" class="rl-grain"/><g class="rl-herb"><path d="M46 84l46 22"/><ellipse cx="54" cy="82" rx="6" ry="2.4" transform="rotate(-30 54 82)"/><ellipse cx="58" cy="94" rx="6" ry="2.4" transform="rotate(50 58 94)"/><ellipse cx="66" cy="87" rx="6" ry="2.4" transform="rotate(-30 66 87)"/><ellipse cx="70" cy="99" rx="6" ry="2.4" transform="rotate(50 70 99)"/><ellipse cx="78" cy="93" rx="6" ry="2.4" transform="rotate(-30 78 93)"/><ellipse cx="82" cy="105" rx="6" ry="2.4" transform="rotate(50 82 105)"/></g><path d="M80 108c2-12 18-19 42-18 20 1 34-4 58-3 28 1 56 3 62 17 5 12-1 24-20 29-22 5-44 0-68 2-26 2-52 7-66-3-9-6-10-15-8-24z" class="rl-raw"/><g clip-path="url(#rl-steak)"><rect x="76" y="86" width="170" height="56" class="rl-cook"/><path d="M96 104c10 3 16-2 26 1M150 122c12-3 18 2 30-1M196 106c8 2 14-1 22 1" class="rl-marble"/><path d="M104 88l-20 52M136 88l-20 52M168 88l-20 52M200 88l-20 52M232 88l-20 52M264 88l-20 52" class="rl-sear"/><path d="M90 102c10-8 26-9 40-8 22 1 36-4 58-3 22 1 40 1 52 8" class="rl-fat"/></g><path d="M80 108c2-12 18-19 42-18 20 1 34-4 58-3 28 1 56 3 62 17 5 12-1 24-20 29-22 5-44 0-68 2-26 2-52 7-66-3-9-6-10-15-8-24z" class="rl-crust"/><g class="rl-pepper"><circle cx="232" cy="146" r="2.6"/><circle cx="240" cy="142" r="2.2"/><circle cx="226" cy="140" r="2"/><circle cx="246" cy="148" r="2.4"/></g><g class="rl-salt"><rect x="214" y="146" width="3" height="3" rx=".6"/><rect x="252" y="140" width="2.6" height="2.6" rx=".6"/><rect x="220" y="150" width="2.4" height="2.4" rx=".6"/></g><g class="rl-steam"><path d="M124 84c-6-8 6-14 0-22s6-14 0-22"/><path d="M160 82c-6-8 6-14 0-22s6-14 0-22"/><path d="M196 84c-6-8 6-14 0-22s6-14 0-22"/></g><g class="rl-tool"><path d="M9 40v16a9 9 0 0 0 18 0V40"/><path d="M15 40v15M21 40v15"/><path d="M18 65v93"/></g><g class="rl-tool"><path d="M306 40c-8 10-10 26-6 40v6h6z" class="rl-blade"/><path d="M303 86v72"/></g></svg>';

/** Đã quá 0,3 giây kể từ lúc mở trang → màn hình chờ của HTML đang hiện, hiện tiếp ngay (không mờ lại từ đầu). */
const shownAlready = () => typeof performance !== 'undefined' && performance.now() > 300;

export function PageLoader({ text = LOADER_TEXT }: { text?: string }) {
  return (
    <div className={shownAlready() ? 'rl rl-now' : 'rl'} role="status" aria-live="polite">
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: ART }} />
      <p className="rl-text">
        <span>{text}</span>
        <span className="rl-dots" />
      </p>
    </div>
  );
}
