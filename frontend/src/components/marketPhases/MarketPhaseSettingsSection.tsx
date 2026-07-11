import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import {
  SessionClockInput,
  MARKET_PHASE_PERIOD_FORM_GRID_CLASS,
  MARKET_PHASE_FORM_LABEL_CLASS,
  MARKET_PHASE_FORM_CONTROL_CLASS,
  MARKET_PHASE_FORM_CLOCK_CLASS,
} from '../common/SessionClockInput';
import {
  marketPhasesService,
  MarketInstrument,
  MarketPhaseSlotConfig,
} from '../../services/marketPhases';

type PeriodRow = {
  key?: string;
  label?: string;
  start: string;
  end: string;
};

const settingsSaveButtonClass =
  'px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50';

export const MarketPhaseSettingsSection: React.FC = () => {
  const { t } = useTranslation(['marketPhases', 'common']);
  const [config, setConfig] = useState<MarketPhaseSlotConfig | null>(null);
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      marketPhasesService.getSlotConfig(),
      marketPhasesService.getInstruments(),
    ])
      .then(([cfg, inst]) => {
        const list = inst.instruments;
        setInstruments(list);
        const keys = list.map((i) => i.key);
        const nextConfig =
          cfg && keys.length > 0 && !keys.includes(cfg.default_instrument_key)
            ? { ...cfg, default_instrument_key: keys[0] }
            : cfg;
        setConfig(nextConfig);
        setPeriods(nextConfig?.custom_analytical_periods?.length ? nextConfig.custom_analytical_periods : []);
      })
      .catch(() => undefined);
  }, []);

  const instrumentOptions = useMemo(
    () => instruments.map((i) => ({ value: i.key, label: i.label })),
    [instruments],
  );

  const modeOptions = useMemo(
    () => [
      { value: 'hour', label: t('settings.modes.hour') },
      { value: 'fixed', label: t('settings.modes.fixed') },
      { value: 'custom', label: t('settings.modes.custom') },
    ],
    [t],
  );

  const durationOptions = useMemo(
    () => [15, 30, 60].map((m) => ({ value: m, label: String(m) })),
    [],
  );

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload: Partial<MarketPhaseSlotConfig> = {
        mode: config.mode,
        duration_minutes: config.duration_minutes,
        default_instrument_key: config.default_instrument_key,
        custom_analytical_periods: config.mode === 'custom' ? periods : [],
      };
      const updated = await marketPhasesService.updateSlotConfig(payload);
      setConfig(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [config, periods]);

  if (!config) return null;

  return (
    <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('settings.title')}</h4>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('settings.analyticalPeriods')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.defaultInstrument')}
          </label>
          <CustomSelect
            value={config.default_instrument_key}
            onChange={(value) => setConfig({ ...config, default_instrument_key: String(value ?? 'nasdaq') })}
            options={instrumentOptions}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('settings.slotMode')}
          </label>
          <CustomSelect
            value={config.mode}
            onChange={(value) =>
              setConfig({ ...config, mode: String(value ?? 'hour') as MarketPhaseSlotConfig['mode'] })
            }
            options={modeOptions}
          />
        </div>
        {config.mode === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Durée (min)
            </label>
            <CustomSelect
              value={config.duration_minutes}
              onChange={(value) =>
                setConfig({ ...config, duration_minutes: Number(value ?? 30) })
              }
              options={durationOptions}
            />
          </div>
        )}
      </div>

      {config.mode === 'custom' && (
        <div className="space-y-2">
          {periods.map((row, idx) => (
            <div key={idx} className={MARKET_PHASE_PERIOD_FORM_GRID_CLASS}>
              <div className="min-w-0">
                <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
                  {t('settings.periodLabel')}
                </label>
                <input
                  className={MARKET_PHASE_FORM_CONTROL_CLASS}
                  value={row.label || ''}
                  onChange={(e) => {
                    const next = [...periods];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setPeriods(next);
                  }}
                />
              </div>
              <div className="min-w-0">
                <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
                  {t('settings.periodStart')}
                </label>
                <SessionClockInput
                  value={row.start}
                  onChange={(start) => {
                    const next = [...periods];
                    next[idx] = { ...next[idx], start };
                    setPeriods(next);
                  }}
                  className={MARKET_PHASE_FORM_CLOCK_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
                  {t('settings.periodEnd')}
                </label>
                <SessionClockInput
                  value={row.end}
                  onChange={(end) => {
                    const next = [...periods];
                    next[idx] = { ...next[idx], end };
                    setPeriods(next);
                  }}
                  minTime={row.start || undefined}
                  className={MARKET_PHASE_FORM_CLOCK_CLASS}
                />
              </div>
              <div className="min-w-0">
                <label className={`${MARKET_PHASE_FORM_LABEL_CLASS} invisible`} aria-hidden="true">
                  .
                </label>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center text-sm text-rose-600 hover:underline dark:text-rose-400"
                  onClick={() => setPeriods(periods.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-sky-600 hover:underline dark:text-sky-400"
            onClick={() => setPeriods([...periods, { start: '12:00', end: '14:00', label: '' }])}
          >
            {t('settings.addPeriod')}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className={settingsSaveButtonClass}
        >
          {saving ? t('saving') : t('common:save', { defaultValue: 'Enregistrer' })}
        </button>
        {saved && <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('saved')}</span>}
      </div>
    </div>
  );
};

export default MarketPhaseSettingsSection;
