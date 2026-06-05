export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getSystemTheme(): ResolvedTheme {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
    }
  } catch {
    // Ignorer les erreurs matchMedia
  }
  return 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  applyResolvedTheme(resolved);
  return resolved;
}

export function subscribeSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY);
  const handler = () => onChange(getSystemTheme());

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }

  mediaQuery.addListener(handler);
  return () => mediaQuery.removeListener(handler);
}

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

export function getNextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_CYCLE.indexOf(current);
  if (index === -1) {
    return 'light';
  }
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}
