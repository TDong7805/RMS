import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NotificationMenu } from '@/components/layout/NotificationMenu';
import { UserMenu } from '@/components/layout/UserMenu';

/**
 * Khung gọn cho "Thông tin của tôi" của Thu ngân (/thu-ngan/toi) và Nhân viên bếp (/bep/toi): nền sáng, nút quay lại khu làm việc.
 * (Nhân viên phục vụ dùng WaiterShell.)
 */
export function SelfShell({ home, homeLabel, children }: { home: string; homeLabel: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-[var(--bg-page)] text-[var(--text-primary)] [color-scheme:light]">
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-3">
        <button type="button" onClick={() => navigate(home)} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-2 text-[13.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
          <ArrowLeft size={17} />
          <span className="hidden sm:inline">{homeLabel}</span>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-extrabold">THÔNG TIN CỦA TÔI</h1>
        <NotificationMenu allHref={`${home}/thong-bao`} />
        <UserMenu />
      </header>
      <main className="flex-1 p-3 sm:p-4">{children}</main>
    </div>
  );
}
