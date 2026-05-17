import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import userService from '../../services/userService';
import { Tooltip } from '../ui';
import { TruncatingTooltipText } from './TruncatingTooltipText';
import type { PnlDisplayMode } from '../../utils/pnlDisplay';
import { parsePnlDisplayMode } from '../../utils/pnlDisplay';

export interface PnlBasisToggleProps {
  /** Mode formulaire Paramètres : pas d’appel API immédiat */
  persistImmediately?: boolean;
  value?: PnlDisplayMode;
  onControlledChange?: (mode: PnlDisplayMode) => void;
  /** header = fond sombre (barre du haut), default = fond clair/sombre page */
  variant?: 'default' | 'header';
  className?: string;
  /**
   * Masque le titre (mode `above` : pas de label au-dessus ; mode `inside` : cadre avec switch seul).
   */
  hideLabel?: boolean;
  /**
   * inside (défaut) : titre dans le cadre à côté du switch — cohérent dashboard / analytics / …
   * above : titre au-dessus du cadre (cas rare).
   */
  labelPosition?: 'above' | 'inside';
}

/**
 * Cadre unique (titre in-field par défaut) : aligné sur PeriodSelector / PositionStrategyPillBar.
 */
const filterRowFrameClass =
  'h-10 w-full min-w-0 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';

export const PnlBasisToggle: React.FC<PnlBasisToggleProps> = ({
  persistImmediately = true,
  value: controlledValue,
  onControlledChange,
  variant = 'default',
  className = '',
  hideLabel = false,
  labelPosition = 'inside',
}) => {
  const { t } = useTranslation(['common', 'settings']);
  const { preferences, mergePreferences } = usePreferences();
  const [saving, setSaving] = useState(false);

  const mode = controlledValue ?? parsePnlDisplayMode(preferences.pnl_display);
  const isGross = mode === 'gross';

  const setMode = async (next: PnlDisplayMode) => {
    if (next === mode) return;
    if (!persistImmediately && onControlledChange) {
      onControlledChange(next);
      return;
    }
    setSaving(true);
    try {
      const updated = await userService.updatePreferences({ pnl_display: next });
      mergePreferences({
        ...updated,
        pnl_display: updated.pnl_display === 'gross' ? 'gross' : 'net',
      });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch {
      // État inchangé tant que le backend n’a pas validé
    } finally {
      setSaving(false);
    }
  };

  const isHeader = variant === 'header';
  const help = t('settings:pnlDisplayHelp');
  const title = t('settings:pnlDisplayTitle');

  const trackClass = isHeader
    ? `relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 disabled:opacity-50 disabled:cursor-not-allowed ${
        isGross ? 'bg-blue-500' : 'bg-white/20'
      }`
    : `relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        isGross ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
      }`;

  const switchButton = (extraBtnClass = '') => (
    <button
      type="button"
      role="switch"
      aria-checked={isGross}
      aria-label={t('common:pnlBasisToggleAria')}
      disabled={saving}
      onClick={() => void setMode(isGross ? 'net' : 'gross')}
      className={`${trackClass} ${extraBtnClass}`.trim()}
    >
      <span className="sr-only">
        {isGross ? t('common:pnlGrossShort') : t('common:pnlNetShort')}
      </span>
      <span
        aria-hidden
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          isGross ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const switchWithTooltip = (
    <Tooltip content={help} position="bottom">
      {switchButton()}
    </Tooltip>
  );

  if (isHeader) {
    return (
      <Tooltip content={help} position="bottom">
        {switchButton(className)}
      </Tooltip>
    );
  }

  if (labelPosition === 'inside') {
    return (
      <div className={`min-w-0 ${className}`.trim()}>
        <div
          className={`${filterRowFrameClass} ${hideLabel ? 'justify-end' : 'justify-between sm:justify-start'}`}
          role="group"
          aria-label={title}
        >
          {!hideLabel && (
            <TruncatingTooltipText
              text={title}
              wrapperClassName="min-w-0 flex-1"
              className="block min-w-0 max-w-full truncate pr-2 text-gray-900 dark:text-gray-100"
            />
          )}
          <span className="flex flex-shrink-0 items-center">{switchWithTooltip}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      {!hideLabel && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</label>
      )}
      <div className={`${filterRowFrameClass} justify-start`} role="group" aria-label={title}>
        {switchWithTooltip}
      </div>
    </div>
  );
};
