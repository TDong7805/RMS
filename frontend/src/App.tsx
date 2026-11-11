import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { BrowserRouter } from 'react-router-dom';
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

const App = () => {
  useEffect(() => {
    initTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <SessionWatcher />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
export { AppRoutes } from './routes';