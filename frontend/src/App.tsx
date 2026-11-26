import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { RouterProvider, createBrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { initTheme, useUiStore } from '@/lib/ui-store';
import { SessionWatcher } from '@/components/auth/RequireAuth';
import { AppRoutes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/** Khu vực dành cho nhân viên (còn lại là website khách hàng công khai — xem routes.tsx). */
const STAFF_PREFIXES = ['/quan-ly', '/thu-ngan', '/bep', '/kho', '/phuc-vu', '/dang-nhap', '/doi-mat-khau'];

/**
 * Thông báo nổi: trang quản lý ở góc trên bên phải; trang đặt món của khách (điện thoại) ở giữa phía dưới,
 * ngay trên thanh giỏ món — không che nút Quay lại / nút ở đầu màn hình; website khách hàng ở giữa phía trên.
 */
function AppToaster() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/goi-mon')) return <Toaster position="bottom-center" richColors offset={150} mobileOffset={{ bottom: 150 }} />;
  if (!STAFF_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return <Toaster position="top-center" richColors closeButton offset={84} />;
  }
  // Trang nhân viên: thông báo kiểu Atlassian Flag (docs/thiet-ke/QUY_TAC_GIAO_DIEN.md) — thẻ trắng, biểu tượng màu
  // theo loại, tiêu đề đậm + 1 dòng mô tả, nút hành động (vd. "Hoàn tác") chữ màu chính.
  return <StaffToaster />;
}

/** Thư viện thông báo tự đặt màu sáng / tối riêng → gán thẳng biến màu của nó theo giao diện hệ thống. */
function StaffToaster() {
  const theme = useUiStore((s) => s.theme);
  return (
    <Toaster
      position="top-right"
      closeButton
      theme={theme}
      toastOptions={{ classNames: FLAG }}
      style={{ '--normal-bg': 'var(--bg-surface)', '--normal-text': 'var(--text-primary)', '--normal-border': 'var(--border)' } as React.CSSProperties}
    />
  );
}

const FLAG = {
  toast:
    'group !items-start !gap-3 !rounded-[12px] !border !border-[var(--border)] !bg-[var(--bg-surface)] !p-3.5 !pr-9 !text-[var(--text-primary)] !shadow-[var(--shadow-overlay)] !font-[inherit]',
  title: '!text-[14px] !font-semibold !leading-5',
  description: '!mt-0.5 !text-[13px] !leading-5 !text-[var(--text-secondary)]',
  icon: '!mt-0.5',
  success: '[&_[data-icon]]:!text-[var(--success)]',
  error: '[&_[data-icon]]:!text-[var(--danger)]',
  warning: '[&_[data-icon]]:!text-[var(--warning)]',
  info: '[&_[data-icon]]:!text-[var(--info)]',
  actionButton: '!ml-auto !h-7 !rounded-[8px] !bg-transparent !px-2 !text-[13px] !font-semibold !text-[var(--accent)] hover:!bg-[var(--accent-soft)]',
  cancelButton: '!h-7 !rounded-[8px] !bg-transparent !px-2 !text-[13px] !text-[var(--text-secondary)]',
  closeButton: '!left-auto !right-2 !top-2 !border-0 !bg-transparent !text-[var(--text-muted)] hover:!bg-[var(--bg-subtle)]',
};

function Root() {
  return (
    <>
      <AppToaster />
      <SessionWatcher />
      <AppRoutes />
    </>
  );
}

/**
 * Dùng bộ định tuyến dạng "data router" (thay BrowserRouter) để chặn được việc rời trang khi còn thay đổi chưa lưu
 * (useBlocker — hooks/use-unsaved-guard.tsx). Toàn bộ trang vẫn khai báo trong AppRoutes (routes.tsx) như cũ.
 */
const router = createBrowserRouter([{ path: '*', element: <Root /> }]);

const App = () => {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
export { AppRoutes } from './routes';