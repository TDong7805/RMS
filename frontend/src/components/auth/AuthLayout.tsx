import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { StaffRole } from '@/api/auth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { cn } from '@/lib/cn';
import { STAFF_ROLE_ORDER, STAFF_ROLES } from '@/lib/staff-roles';

/** Logo giống sidebar trang quản lý. */
export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--accent)] font-mono text-[15px] font-bold text-[var(--accent-contrast)]"
        aria-hidden
      >
        GL
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold leading-5 text-[var(--text-primary)]">Green Lotus</span>
        <span className="block text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Restaurant Manager
        </span>
      </span>
    </div>
  );
}

type HeroTab = 'overview' | StaffRole;

const TABS: { id: HeroTab; label: string }[] = [
  { id: 'overview', label: 'Tổng quan' },
  ...STAFF_ROLE_ORDER.map((role) => ({ id: role, label: STAFF_ROLES[role].tab })),
];

const EYEBROW = 'text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]';

/** Nội dung mảng bên phải theo tab: lời chào (Tổng quan) hoặc giới thiệu công việc của một vị trí. */
function HeroPanel({ tab }: { tab: HeroTab }) {
  if (tab === 'overview') {
    return (
      <>
        <p className={EYEBROW}>Green Lotus · Quận 1</p>
        <h2 className="mt-3 whitespace-nowrap text-[40px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] xl:text-[52px]">
          Chào mừng trở lại.
        </h2>
        <p className="mt-4 max-w-[460px] text-[15.5px] leading-7 text-[var(--text-secondary)]">
          Một hệ thống cho cả nhà hàng — mỗi bộ phận một khu vực riêng, phối hợp trên cùng một nơi.
        </p>
      </>
    );
  }

  const role = STAFF_ROLES[tab];
  const Icon = role.icon;
  return (
    <>
      <p className={cn(EYEBROW, 'flex items-center gap-2')}>
        <Icon size={15} strokeWidth={2} aria-hidden />
        Vị trí
      </p>
      <h2 className="mt-3 text-[36px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[var(--text-primary)] xl:text-[44px]">
        {role.title}
      </h2>
      <p className="mt-3 max-w-[480px] text-[15.5px] leading-7 text-[var(--text-secondary)]">{role.summary}</p>
      <ul className="mt-5 space-y-2.5">
        {role.features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-[14.5px] leading-6 text-[var(--text-primary)]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Check size={12} strokeWidth={3} aria-hidden />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--accent)]">
        Sau khi đăng nhập <ArrowRight size={14} aria-hidden /> {role.destination}
      </p>
      <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
        Hệ thống tự nhận vị trí theo tài khoản — không cần chọn trước khi đăng nhập.
      </p>
    </>
  );
}

/**
 * Bố cục trang đăng nhập / đổi mật khẩu: một khung bo góc đặt giữa màn hình (tối đa 1200 × 760px),
 * form bên trái, mảng gradient bên phải có tab giới thiệu từng vị trí.
 * Màn hình hẹp (< 1024px) chỉ còn form, không có khung.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<HeroTab>('overview');
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Phím ←/→ chuyển tab (chuẩn tablist cho bàn phím và trình đọc màn hình).
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-page)] lg:items-center lg:justify-center lg:p-8">
      <div className="flex w-full lg:h-[min(760px,calc(100vh-4rem))] lg:min-h-[640px] lg:max-w-[1200px] lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-[var(--border)] lg:shadow-soft">
        <section className="flex w-full flex-col overflow-y-auto bg-[var(--bg-surface)] px-6 py-6 sm:px-10 lg:w-[460px] lg:shrink-0 xl:px-12">
          <header className="flex items-center justify-between">
            <BrandMark />
            <ThemeToggle />
          </header>

          <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-8">{children}</div>

          <footer className="text-center text-[12px] text-[var(--text-muted)] lg:text-left">
            © {new Date().getFullYear()} Green Lotus · Hệ thống quản lý và vận hành nhà hàng
          </footer>
        </section>

        <section className="rm-auth-hero relative hidden min-w-0 flex-1 flex-col lg:flex" aria-label="Giới thiệu hệ thống">
          <nav className="flex justify-end p-6">
            <div
              role="tablist"
              aria-label="Giới thiệu từng vị trí"
              className="flex gap-1 rounded-pill border border-[var(--border)] bg-[var(--bg-surface)]/70 p-1 shadow-soft backdrop-blur"
            >
              {TABS.map(({ id, label }, index) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`hero-tab-${id}`}
                    aria-selected={active}
                    aria-controls="hero-panel"
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(id)}
                    onKeyDown={(event) => handleTabKey(event, index)}
                    className={cn(
                      'whitespace-nowrap rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 xl:px-4',
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-soft'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--accent)]',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div
            key={tab}
            id="hero-panel"
            role="tabpanel"
            aria-labelledby={`hero-tab-${tab}`}
            className="rm-animate-in mt-auto px-12 pb-12 xl:px-14 xl:pb-14"
          >
            <HeroPanel tab={tab} />
          </div>
        </section>
      </div>
    </div>
  );
}
