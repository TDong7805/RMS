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

/**
 * Thông báo nổi: trang quản lý ở góc trên bên phải; trang đặt món của khách (điện thoại) ở giữa phía dưới,
 * ngay trên thanh giỏ món — không che nút Quay lại / nút ở đầu màn hình.
 */
function AppToaster() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/goi-mon')) return <Toaster position="bottom-center" richColors offset={150} mobileOffset={{ bottom: 150 }} />;
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