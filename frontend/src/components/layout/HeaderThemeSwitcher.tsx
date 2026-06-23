import React, { useEffect, useRef, useState } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { ThemePreference } from '../../utils/theme';
import { Tooltip } from '../ui';

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  Icon: typeof Sun;
  labelKey: 'settings:themeLight' | 'settings:themeDark' | 'settings:themeSystem';
}> = [
  { value: 'light', Icon: Sun, labelKey: 'settings:themeLight' },
  { value: 'dark', Icon: Moon, labelKey: 'settings:themeDark' },
  { value: 'system', Icon: Monitor, labelKey: 'settings:themeSystem' },
];

const TOGGLE_ROOT_CLASS =
  'inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-0.5 dark:border-gray-600 dark:bg-gray-900';

const TOGGLE_ITEM_CLASS =
  'inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-all duration-200 ' +
  'hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ' +
  'data-[state=on]:bg-blue-600 data-[state=on]:text-white data-[state=on]:shadow-sm ' +
  'data-[state=on]:hover:bg-blue-600 data-[state=on]:hover:text-white ' +
  'dark:data-[state=on]:bg-blue-500 dark:data-[state=on]:text-white dark:data-[state=on]:hover:bg-blue-500 dark:data-[state=on]:hover:text-white ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-800';

const TRIGGER_CLASS =
  'inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-blue-950 focus-visible:ring-2';

function TriggerIcon({ preference }: { preference: ThemePreference }) {
  const option = THEME_OPTIONS.find((item) => item.value === preference) ?? THEME_OPTIONS[0];
  const { Icon } = option;
  return <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />;
}

export const HeaderThemeSwitcher: React.FC = () => {
  const { t } = useI18nTranslation();
  const { themePreference, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    themePreference === 'system'
      ? t('settings:themeSystem')
      : themePreference === 'dark'
        ? t('settings:themeDark')
        : t('settings:themeLight');

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleThemeChange = (value: string) => {
    if (value !== 'light' && value !== 'dark' && value !== 'system') {
      return;
    }
    void setTheme(value);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content={isOpen ? t('settings:theme') : currentLabel} position="left">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className={`${TRIGGER_CLASS}${isOpen ? ' ring-2 ring-blue-400/80 ring-offset-2 ring-offset-blue-950' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={t('settings:theme')}
        >
          <TriggerIcon preference={themePreference} />
        </button>
      </Tooltip>

      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
          role="presentation"
        >
          <ToggleGroup.Root
            type="single"
            value={themePreference}
            onValueChange={handleThemeChange}
            aria-label={t('settings:theme')}
            className={TOGGLE_ROOT_CLASS}
          >
            {THEME_OPTIONS.map(({ value, Icon, labelKey }) => (
              <ToggleGroup.Item
                key={value}
                value={value}
                aria-label={t(labelKey)}
                title={t(labelKey)}
                className={TOGGLE_ITEM_CLASS}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
      )}
    </div>
  );
};

export default HeaderThemeSwitcher;
