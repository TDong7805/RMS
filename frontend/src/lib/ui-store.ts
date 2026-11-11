import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'rms-theme';

function resolveInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

interface UiState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: resolveInitialTheme(),
  sidebarCollapsed: false,
  mobileNavOpen: false,
  setTheme: (theme) => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));

/** Gọi một lần khi ứng dụng khởi động để áp theme đã lưu / theo hệ thống. */
export function initTheme(): void {
  applyTheme(useUiStore.getState().theme);
}