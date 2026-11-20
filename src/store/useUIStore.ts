import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isSidebarOpen: boolean;
  adminTheme: 'dark' | 'light';
  memberTheme: 'dark' | 'light';
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setAdminTheme: (theme: 'dark' | 'light') => void;
  toggleAdminTheme: () => void;
  setMemberTheme: (theme: 'dark' | 'light') => void;
  toggleMemberTheme: () => void;
  // Backwards compatibility properties
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      adminTheme: 'dark',
      memberTheme: 'dark',
      theme: 'dark',
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      closeSidebar: () => set({ isSidebarOpen: false }),
      setAdminTheme: (adminTheme) => set({ adminTheme }),
      toggleAdminTheme: () => set((state) => ({ adminTheme: state.adminTheme === 'dark' ? 'light' : 'dark' })),
      setMemberTheme: (memberTheme) => set({ memberTheme }),
      toggleMemberTheme: () => set((state) => ({ memberTheme: state.memberTheme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme, memberTheme: theme }),
      toggleTheme: () => set((state) => {
        const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
        return { theme: nextTheme, memberTheme: nextTheme };
      }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
