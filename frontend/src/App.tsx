import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { initTheme } from '@/lib/ui-store';
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
  return <Toaster position="top-right" richColors closeButton />;
}

const App = () => {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter>
          <AppToaster />
          <SessionWatcher />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
export { AppRoutes } from './routes';