import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FolderTree, Layers, Soup, UtensilsCrossed } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SubPageHeader } from '@/components/common/SubPageHeader';
import { cn } from '@/lib/cn';

/**
 * Trang "Thực đơn" gom 4 tab (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md, mục B8). Mọi tab cùng bố cục:
 * tiêu đề + tab ở trên, nút chính "Thêm …" luôn ở bên phải, bên dưới là danh sách (tìm / lọc bên trái).
 */
export type MenuTab = 'dishes' | 'sets' | 'categories' | 'groups';

export const MENU_TABS: { value: MenuTab; label: string; path: string; icon: ReactNode }[] = [
  { value: 'dishes', label: 'Món ăn', path: '/quan-ly/mon-an', icon: <UtensilsCrossed size={15} /> },
  { value: 'sets', label: 'Set menu', path: '/quan-ly/mon-an/set-menu', icon: <Soup size={15} /> },
  { value: 'categories', label: 'Danh mục', path: '/quan-ly/mon-an/danh-muc', icon: <FolderTree size={15} /> },
  { value: 'groups', label: 'Nhóm món', path: '/quan-ly/mon-an/nhom-mon', icon: <Layers size={15} /> },
];

export const MENU_HOME = '/quan-ly/mon-an';

/**
 * Đầu trang con thêm / sửa (món, set): tiêu đề + mô tả bên trái, nút "Quay lại" có viền bên phải.
 * Chỉ có MỘT nút Lưu, nằm ở thanh dính đáy (StickySaveBar) — luôn hiện, đi theo khi cuộn, kèm số chỗ còn lỗi.
 * Rời trang khi chưa lưu (kể cả bằng menu trái / Ctrl+K) thì useUnsavedGuard hỏi trước.
 */
export function MenuFormHeader({ title, description, backTo }: { title: string; description?: ReactNode; backTo: string }) {
  return <SubPageHeader title={title} description={description} backTo={backTo} />;
}

export function MenuLayout({ tab, action, children }: { tab: MenuTab; action?: ReactNode; children: ReactNode }) {
  const current = MENU_TABS.find((t) => t.value === tab)!;
  return (
    <AppShell meta={{ label: current.label, parent: 'Thực đơn', parentTo: MENU_HOME }}>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="truncate text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">
            Thực đơn
          </h1>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
        <nav aria-label="Phần của thực đơn" className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
          {MENU_TABS.map((t) => {
            const active = t.value === tab;
            return (
              <Link
                key={t.value}
                to={t.path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-semibold transition-colors',
                  active
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                {t.icon}
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}
