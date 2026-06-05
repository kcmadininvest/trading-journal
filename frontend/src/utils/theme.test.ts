import {
  applyResolvedTheme,
  applyThemePreference,
  getNextThemePreference,
  getSystemTheme,
  isThemePreference,
  resolveTheme,
  subscribeSystemTheme,
} from './theme';

describe('theme utils', () => {
  const originalMatchMedia = window.matchMedia;
  let mediaQueryListeners: Set<(event: MediaQueryListEvent) => void>;
  let mediaQueryMatches: boolean;

  beforeEach(() => {
    mediaQueryListeners = new Set();
    mediaQueryMatches = false;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      get matches() {
        return mediaQueryMatches;
      },
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaQueryListeners.add(listener);
      },
      removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaQueryListeners.delete(listener);
      },
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaQueryListeners.add(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaQueryListeners.delete(listener);
      },
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.documentElement.classList.remove('dark');
  });

  function dispatchSystemThemeChange(matches: boolean) {
    mediaQueryMatches = matches;
    mediaQueryListeners.forEach((listener) => {
      listener({ matches } as MediaQueryListEvent);
    });
  }

  describe('isThemePreference', () => {
    it('accepte light, dark et system', () => {
      expect(isThemePreference('light')).toBe(true);
      expect(isThemePreference('dark')).toBe(true);
      expect(isThemePreference('system')).toBe(true);
      expect(isThemePreference('auto')).toBe(false);
    });
  });

  describe('resolveTheme', () => {
    it('retourne light ou dark tel quel', () => {
      expect(resolveTheme('light')).toBe('light');
      expect(resolveTheme('dark')).toBe('dark');
    });

    it('résout system via matchMedia', () => {
      mediaQueryMatches = true;
      expect(resolveTheme('system')).toBe('dark');

      mediaQueryMatches = false;
      expect(resolveTheme('system')).toBe('light');
    });
  });

  describe('getSystemTheme', () => {
    it('retourne light si matchMedia indisponible', () => {
      window.matchMedia = undefined as unknown as typeof window.matchMedia;
      expect(getSystemTheme()).toBe('light');
    });
  });

  describe('applyResolvedTheme', () => {
    it('ajoute ou retire la classe dark sur html', () => {
      applyResolvedTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      applyResolvedTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('applyThemePreference', () => {
    it('applique le thème résolu', () => {
      mediaQueryMatches = true;
      expect(applyThemePreference('system')).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('subscribeSystemTheme', () => {
    it('notifie lors d’un changement OS', () => {
      const onChange = jest.fn();
      const unsubscribe = subscribeSystemTheme(onChange);

      dispatchSystemThemeChange(true);
      expect(onChange).toHaveBeenCalledWith('dark');

      unsubscribe();
      onChange.mockClear();
      dispatchSystemThemeChange(false);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('getNextThemePreference', () => {
    it('fait défiler light → dark → system → light', () => {
      expect(getNextThemePreference('light')).toBe('dark');
      expect(getNextThemePreference('dark')).toBe('system');
      expect(getNextThemePreference('system')).toBe('light');
    });
  });
});
