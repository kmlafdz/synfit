import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';

interface LanguageState {
  language: 'id' | 'en';
  setLanguage: (lang: 'id' | 'en') => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'id',
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'language-storage',
    }
  )
);

export function useLanguage() {
  const store = useLanguageStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    language: (mounted ? store.language : 'id') as 'id' | 'en',
    setLanguage: store.setLanguage,
  };
}
