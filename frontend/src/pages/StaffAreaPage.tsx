import { Construction } from 'lucide-react';
import type { StaffRole } from '@/api/auth';
import { BrandMark } from '@/components/auth/AuthLayout';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { UserMenu } from '@/components/layout/UserMenu';
import { STAFF_ROLES } from '@/lib/staff-roles';

type Area = Exclude<StaffRole, 'manager'>;

/**
 * Khung khu vực của Thu ngân / Bếp / Kho — tạm thời chưa có chức năng, chờ nhóm hoàn thiện đặc tả.
 * Nội dung giới thiệu lấy từ lib/staff-roles.ts (dùng chung với trang đăng nhập).
 * Phân hệ nào làm xong thì thay trang này bằng trang thật.
 */
export default function StaffAreaPage({ area }: { area: Area }) {
  const { tab, icon: Icon, summary, features } = STAFF_ROLES[area];

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <BrandMark />
            <span className="hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden />
            <span className="hidden items-center gap-2 text-[14px] font-semibold text-[var(--text-secondary)] sm:flex">
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              Khu vực {tab}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 sm:py-16">
        <div className="rm-animate-in rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-10">
          <span className="grid h-14 w-14 place-items-center rounded-item bg-[var(--accent-soft)] text-[var(--accent)]">
            <Icon size={26} strokeWidth={1.75} aria-hidden />
          </span>
          <h1 className="mt-5 text-[26px] font-extrabold tracking-[-0.02em]">Khu vực {tab}</h1>
          <p className="mt-1.5 text-[14.5px] text-[var(--text-secondary)]">{summary}</p>
          <p className="mt-4 flex items-center gap-2 rounded-item bg-[var(--warning-soft)] px-3.5 py-2.5 text-[13.5px] text-[var(--text-primary)]">
            <Construction size={16} className="shrink-0 text-[var(--warning)]" aria-hidden />
            Phân hệ đang được xây dựng. Bạn đã đăng nhập đúng khu vực của mình.
          </p>

          <h2 className="mt-8 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Chức năng sẽ có
          </h2>
          <ul className="mt-3 space-y-2.5">
            {features.map((feature) => (
              <li key={feature} className="flex gap-3 text-[14.5px] text-[var(--text-primary)]">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
