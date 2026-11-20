import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('cm-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* sem acesso ao armazenamento: usa o padrão do sistema */
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('cm-theme', theme);
    } catch {
      /* ignora */
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

/** Trava o cofre depois de `minutes` sem nenhuma interação. */
export function useAutoLock(active: boolean, minutes: number, onLock: () => void) {
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    // Compara com o relógio, então também trava se o PC dormir com o app aberto.
    const id = setInterval(() => {
      if (Date.now() - last > minutes * 60_000) onLock();
    }, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
    };
  }, [active, minutes, onLock]);
}
