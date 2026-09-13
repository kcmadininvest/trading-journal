import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast/headless';
import { PageShell } from '../components/layout';
import { ConfirmModal, Tooltip } from '../components/ui';
import { DateInput } from '../components/common/DateInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { InstrumentPicker } from '../components/backtestJournal/InstrumentPicker';
import { ObservationGrid } from '../components/backtestJournal/ObservationGrid';
import { BacktestEquityChart } from '../components/backtestJournal/BacktestEquityChart';
import {
  replayCardClass,
  replayPrimaryButtonClass,
  replaySecondaryButtonClass,
} from '../components/replay/replayStyles';
import { usePreferences } from '../hooks/usePreferences';
import { formatDate, formatDateTimeShort } from '../utils/dateFormat';
import { formatNumber } from '../utils/numberFormat';
import { positionStrategiesService, type PositionStrategy } from '../services/positionStrategies';
import backtestJournalService, {
  type AnalysisFilters,
  type AnalysisResponse,
  type BacktestCampaign,
  type BacktestMetrics,
  type BacktestObservation,
  type BacktestStrategy,
  type BacktestVersion,
  type EquityPoint,
} from '../services/backtestJournal';

function campaignPeriodBounds() {
  const year = new Date().getFullYear();
  return {
    period_start: `${year - 10}-01-01`,
    period_end: `${year + 1}-12-31`,
  };
}

type View = 'list' | 'strategy' | 'campaign' | 'grid' | 'analysis';
type WorkspaceView = 'campaign' | 'grid' | 'analysis';

function isWorkspaceView(view: View): view is WorkspaceView {
  return view === 'campaign' || view === 'grid' || view === 'analysis';
}

function parseView(): { view: View; strategyId?: number; campaignId?: number } {
  const raw = window.location.hash.replace('#', '');
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return { view: 'list' };
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  const view = (params.get('view') as View) || 'list';
  return {
    view,
    strategyId: params.get('strategy') ? Number(params.get('strategy')) : undefined,
    campaignId: params.get('campaign') ? Number(params.get('campaign')) : undefined,
  };
}

function setHash(view: View, strategyId?: number, campaignId?: number) {
  const params = new URLSearchParams();
  if (view !== 'list') params.set('view', view);
  if (strategyId) params.set('strategy', String(strategyId));
  if (campaignId) params.set('campaign', String(campaignId));
  const query = params.toString();
  window.location.hash = query ? `backtest-journal?${query}` : 'backtest-journal';
}

async function ensureCampaign(
  journal: BacktestStrategy,
  options: { timezone: string; name: string },
): Promise<{ journal: BacktestStrategy; campaign: BacktestCampaign; campaigns: BacktestCampaign[] }> {
  let full =
    journal.latest_version || (journal.versions && journal.versions.length > 0)
      ? journal
      : await backtestJournalService.getStrategy(journal.id);
  let list = await backtestJournalService.listCampaigns(full.id);
  if (list.length > 0) {
    return { journal: full, campaign: list[0], campaigns: list };
  }
  if (!full.latest_version && !full.versions?.length) {
    full = await backtestJournalService.getStrategy(full.id);
  }
  const version = full.latest_version || full.versions?.[0];
  if (!version) {
    throw new Error('missing-version');
  }
  const period = campaignPeriodBounds();
  const created = await backtestJournalService.createCampaign({
    strategy_version: version.id,
    name: options.name,
    instrument: full.default_instrument || '',
    period_start: period.period_start,
    period_end: period.period_end,
    timezone: options.timezone || 'America/New_York',
    status: 'IN_PROGRESS',
    require_refusal_reason: false,
  });
  list = await backtestJournalService.listCampaigns(full.id);
  return {
    journal: full,
    campaign: list.find((item) => item.id === created.id) || created,
    campaigns: list,
  };
}

const BacktestJournalPage: React.FC = () => {
  const { t } = useTranslation('backtestJournal');
  const { preferences } = usePreferences();
  const [route, setRoute] = useState(parseView);
  const [strategies, setStrategies] = useState<BacktestStrategy[]>([]);
  const [positionStrategies, setPositionStrategies] = useState<PositionStrategy[]>([]);
  const [strategy, setStrategy] = useState<BacktestStrategy | null>(null);
  const [campaigns, setCampaigns] = useState<BacktestCampaign[]>([]);
  const [campaign, setCampaign] = useState<BacktestCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteCampaignId, setDeleteCampaignId] = useState<number | null>(null);
  const [statsNonce, setStatsNonce] = useState(0);

  const syncRoute = useCallback(() => setRoute(parseView()), []);
  useEffect(() => {
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, [syncRoute]);

  const campaignOptions = useMemo(
    () => ({
      timezone: preferences.timezone || 'America/New_York',
      name: t('newCampaign'),
    }),
    [preferences.timezone, t],
  );

  const openWorkspace = useCallback(
    async (journal: BacktestStrategy, tab: WorkspaceView = 'grid') => {
      const result = await ensureCampaign(journal, {
        timezone: campaignOptions.timezone,
        name: journal.name || campaignOptions.name,
      });
      setStrategy(result.journal);
      setCampaigns(result.campaigns);
      setHash(tab, result.journal.id, result.campaign.id);
    },
    [campaignOptions],
  );

  const openFromPositionStrategy = useCallback(
    async (positionStrategyId: number) => {
      try {
        setLoading(true);
        const journal = await backtestJournalService.createStrategy({
          position_strategy: positionStrategyId,
        });
        await openWorkspace(journal, 'grid');
      } catch {
        toast.error(t('error'));
      } finally {
        setLoading(false);
      }
    },
    [openWorkspace, t],
  );

  const reloadStrategy = useCallback(async (strategyId: number) => {
    const data = await backtestJournalService.getStrategy(strategyId);
    const list = await backtestJournalService.listCampaigns(data.id);
    setStrategy(data);
    setCampaigns(list);
    return { data, list };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const [journals, positions] = await Promise.all([
        backtestJournalService.listStrategies(),
        positionStrategiesService.list({ is_current: true }),
      ]);
      setStrategies(journals);
      setPositionStrategies(positions);
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (route.view === 'list') void loadList();
  }, [route.view, loadList]);

  useEffect(() => {
    if (!route.strategyId) {
      setStrategy(null);
      setCampaigns([]);
      return;
    }
    void (async () => {
      try {
        const data = await backtestJournalService.getStrategy(route.strategyId!);
        const [list, positions] = await Promise.all([
          backtestJournalService.listCampaigns(data.id),
          positionStrategiesService.list({ is_current: true }),
        ]);
        setStrategy(data);
        setCampaigns(list);
        setPositionStrategies(positions);
      } catch {
        toast.error(t('error'));
      }
    })();
  }, [route.strategyId, t]);

  useEffect(() => {
    if (!route.campaignId) {
      setCampaign(null);
      return;
    }
    void (async () => {
      try {
        setCampaign(await backtestJournalService.getCampaign(route.campaignId!));
      } catch {
        toast.error(t('error'));
      }
    })();
  }, [route.campaignId, statsNonce, t]);

  const openingWorkspace = useRef(false);
  useEffect(() => {
    if (!strategy || strategy.id !== route.strategyId) {
      return;
    }
    const needsRedirect =
      route.view === 'strategy' || (isWorkspaceView(route.view) && !route.campaignId);
    if (!needsRedirect) {
      openingWorkspace.current = false;
      return;
    }
    if (openingWorkspace.current) return;
    openingWorkspace.current = true;
    const journal = strategy;
    void openWorkspace(journal, isWorkspaceView(route.view) ? route.view : 'grid').catch(() => {
      openingWorkspace.current = false;
      toast.error(t('error'));
    });
  }, [openWorkspace, route.campaignId, route.strategyId, route.view, strategy, t]);

  const latestVersion = strategy?.latest_version || strategy?.versions?.[0] || null;
  const campaignVersion =
    strategy?.versions?.find((item) => item.id === campaign?.strategy_version) || latestVersion;

  const showStrategyInvite =
    route.view === 'list' && !loading && positionStrategies.length === 0;
  const currentTab: WorkspaceView = isWorkspaceView(route.view) ? route.view : 'grid';
  const showWorkspace =
    Boolean(strategy && campaign && campaignVersion) && isWorkspaceView(route.view);

  return (
    <PageShell variant="fluid">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {showStrategyInvite ? (
              <Trans
                i18nKey="emptyStrategies"
                ns="backtestJournal"
                components={{
                  strategiesLink: (
                    <a
                      href="#position-strategies"
                      className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    />
                  ),
                }}
              />
            ) : (
              t('subtitle')
            )}
          </p>
        </div>
        {route.view !== 'list' && (
          <button
            type="button"
            className={`${replayPrimaryButtonClass} min-w-[10.5rem] gap-2 px-5 sm:px-6 shadow-sm`}
            onClick={() => setHash('list')}
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('backToList')}
          </button>
        )}
      </div>

      {route.view === 'list' && (
        <StrategyList
          loading={loading}
          positionStrategies={positionStrategies}
          journals={strategies}
          onOpen={openFromPositionStrategy}
        />
      )}

      {(route.view === 'strategy' || (isWorkspaceView(route.view) && !showWorkspace)) && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>
      )}

      {showWorkspace && strategy && campaign && campaignVersion && (
        <CampaignWorkspace
          strategy={strategy}
          campaign={campaign}
          campaigns={campaigns}
          version={campaignVersion}
          positionStrategies={positionStrategies}
          view={currentTab}
          statsNonce={statsNonce}
          onStatsInvalidate={() => setStatsNonce((n) => n + 1)}
          onReload={() => reloadStrategy(strategy.id)}
          onSwitchPositionStrategy={openFromPositionStrategy}
          onSwitchCampaign={(id) => setHash(currentTab, strategy.id, id)}
          onCampaignOpened={(item) => setHash(currentTab, strategy.id, item.id)}
          onDeleteCampaign={setDeleteCampaignId}
        />
      )}

      <ConfirmModal
        isOpen={deleteCampaignId != null}
        onClose={() => setDeleteCampaignId(null)}
        onConfirm={async () => {
          if (deleteCampaignId == null || !strategy) return;
          try {
            const deletedId = deleteCampaignId;
            await backtestJournalService.deleteCampaign(deletedId);
            toast.success(t('deleted'));
            setDeleteCampaignId(null);
            const remaining = await backtestJournalService.listCampaigns(strategy.id);
            setCampaigns(remaining);
            if (campaign?.id === deletedId || !remaining.some((item) => item.id === campaign?.id)) {
              if (remaining.length > 0) {
                setHash(currentTab, strategy.id, remaining[0].id);
              } else {
                setCampaign(null);
                setHash('list');
              }
            }
          } catch {
            toast.error(t('saveError'));
          }
        }}
        title={t('delete')}
        message={t('confirmDeleteCampaign')}
        variant="warning"
      />
    </PageShell>
  );
};

function StrategyList({
  loading,
  positionStrategies,
  journals,
  onOpen,
}: {
  loading: boolean;
  positionStrategies: PositionStrategy[];
  journals: BacktestStrategy[];
  onOpen: (positionStrategyId: number) => Promise<void>;
}) {
  const { t } = useTranslation('backtestJournal');
  const journalByPosition = new Map(
    journals
      .filter((item) => item.position_strategy)
      .map((item) => [item.position_strategy as number, item])
  );
  if (loading) return <p className="text-sm text-gray-500">{t('loading')}</p>;
  if (positionStrategies.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {positionStrategies.map((item) => {
        const journal = journalByPosition.get(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`${replayCardClass} p-4 text-left hover:border-blue-400`}
            onClick={() => void onOpen(item.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-medium text-gray-900 dark:text-gray-100">{item.title}</h2>
              {journal?.campaign_count ? (
                <span className="text-xs text-gray-500">
                  {journal.campaign_count} {t('campaigns').toLowerCase()}
                </span>
              ) : null}
            </div>
            {item.description && (
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CampaignWorkspace({
  strategy,
  campaign,
  campaigns,
  version,
  positionStrategies,
  view,
  statsNonce,
  onStatsInvalidate,
  onReload,
  onSwitchPositionStrategy,
  onSwitchCampaign,
  onCampaignOpened,
  onDeleteCampaign,
}: {
  strategy: BacktestStrategy;
  campaign: BacktestCampaign;
  campaigns: BacktestCampaign[];
  version: BacktestVersion;
  positionStrategies: PositionStrategy[];
  view: WorkspaceView;
  statsNonce: number;
  onStatsInvalidate: () => void;
  onReload: () => Promise<{ data: BacktestStrategy; list: BacktestCampaign[] }>;
  onSwitchPositionStrategy: (positionStrategyId: number) => Promise<void>;
  onSwitchCampaign: (id: number) => void;
  onCampaignOpened: (item: BacktestCampaign) => void;
  onDeleteCampaign: (id: number) => void;
}) {
  const { t } = useTranslation('backtestJournal');
  const [instrument, setInstrument] = useState(campaign.instrument || strategy.default_instrument || '');
  const [savingInstrument, setSavingInstrument] = useState(false);

  useEffect(() => {
    setInstrument(campaign.instrument || strategy.default_instrument || '');
  }, [campaign.id, campaign.instrument, strategy.default_instrument]);

  const savedInstrument = campaign.instrument || strategy.default_instrument || '';

  useEffect(() => {
    if (instrument === savedInstrument) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSavingInstrument(true);
        try {
          await backtestJournalService.updateStrategy(strategy.id, {
            default_instrument: instrument,
          });
          await backtestJournalService.updateCampaign(campaign.id, {
            instrument,
          });
          await onReload();
          onStatsInvalidate();
        } catch {
          toast.error(t('saveError'));
        } finally {
          setSavingInstrument(false);
        }
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    instrument,
    savedInstrument,
    strategy.id,
    campaign.id,
    onReload,
    onStatsInvalidate,
    t,
  ]);

  const strategyOptions = useMemo(() => {
    const options = positionStrategies.map((item) => ({
      value: item.id,
      label: item.title,
    }));
    const currentId = strategy.position_strategy;
    if (currentId && !options.some((item) => Number(item.value) === currentId)) {
      options.unshift({
        value: currentId,
        label: strategy.position_strategy_title || strategy.name,
      });
    }
    return options;
  }, [
    positionStrategies,
    strategy.name,
    strategy.position_strategy,
    strategy.position_strategy_title,
  ]);
  const campaignSelectOptions = useMemo(
    () => campaigns.map((item) => ({ value: item.id, label: item.name })),
    [campaigns],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className={`${replayCardClass} space-y-3 p-4`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(12rem,1fr)]">
          <label className="text-sm">
            {t('selectStrategy')}
            <div className="mt-1">
              <CustomSelect
                value={strategy.position_strategy ?? ''}
                onChange={(next) => {
                  if (next == null || next === '') return;
                  void onSwitchPositionStrategy(Number(next));
                }}
                options={strategyOptions}
                placeholder={t('selectStrategy')}
                searchable
              />
            </div>
          </label>
          <label className="text-sm">
            {t('selectCampaign')}
            <div className="mt-1">
              <CustomSelect
                value={campaign.id}
                onChange={(next) => {
                  if (next == null || next === '') return;
                  onSwitchCampaign(Number(next));
                }}
                options={campaignSelectOptions}
                placeholder={t('selectCampaign')}
              />
            </div>
          </label>
          <label className="text-sm">
            {t('instrument')}
            <InstrumentPicker value={instrument} onChange={setInstrument} />
            {savingInstrument && (
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{t('saving')}</span>
            )}
          </label>
        </div>
      </section>

      <div className="grid w-full grid-cols-3 gap-2">
        {(['campaign', 'grid', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${view === tab ? replayPrimaryButtonClass : replaySecondaryButtonClass} min-w-0 w-full`}
            onClick={() => setHash(tab, campaign.strategy_id, campaign.id)}
          >
            {t(tab === 'campaign' ? 'dashboard' : tab === 'grid' ? 'grid' : 'analysis')}
          </button>
        ))}
      </div>

      {view === 'campaign' && (
        <CampaignDashboard campaign={campaign} nonce={statsNonce} />
      )}
      {view === 'grid' && (
        <ObservationGrid
          campaign={campaign}
          onStatsInvalidate={onStatsInvalidate}
        />
      )}
      {view === 'analysis' && (
        <AnalysisView campaign={campaign} />
      )}

      <details className={`${replayCardClass} p-4`}>
        <summary className="cursor-pointer font-medium text-gray-900 dark:text-gray-100">
          {t('campaigns')}
        </summary>
        <div className="mt-3">
          <CampaignSection
            strategy={strategy}
            version={version}
            campaigns={campaigns}
            onOpen={onSwitchCampaign}
            onCreated={async (created) => {
              await onReload();
              if (created) onCampaignOpened(created);
              else onStatsInvalidate();
            }}
            onDelete={onDeleteCampaign}
          />
        </div>
      </details>
    </div>
  );
}

function CampaignSection({
  strategy,
  version,
  campaigns,
  onOpen,
  onCreated,
  onDelete,
}: {
  strategy: BacktestStrategy;
  version?: BacktestVersion;
  campaigns: BacktestCampaign[];
  onOpen: (id: number) => void;
  onCreated: (campaign?: BacktestCampaign) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('backtestJournal');
  const { preferences } = usePreferences();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState(strategy.default_instrument || '');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sessionTz, setSessionTz] = useState('America/New_York');

  const resetForm = () => {
    setEditingId(null);
    setOpen(false);
    setName('');
    setInstrument(strategy.default_instrument || '');
    setStart('');
    setEnd('');
    setSessionTz('America/New_York');
  };

  const startCreate = () => {
    resetForm();
    setOpen(true);
  };

  const startEdit = (item: BacktestCampaign) => {
    setEditingId(item.id);
    setName(item.name);
    setInstrument(item.instrument);
    setStart(item.period_start);
    setEnd(item.period_end);
    setSessionTz(item.timezone || 'America/New_York');
    setOpen(true);
  };

  const duplicateCampaign = async (item: BacktestCampaign) => {
    if (!version) return;
    try {
      const created = await backtestJournalService.createCampaign({
        strategy_version: version.id,
        name: `${item.name} (${t('copySuffix')})`,
        instrument: item.instrument,
        period_start: item.period_start,
        period_end: item.period_end,
        timezone: item.timezone,
        status: 'IN_PROGRESS',
        require_refusal_reason: item.require_refusal_reason,
      });
      toast.success(t('created'));
      await onCreated(created);
    } catch {
      toast.error(t('saveError'));
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{t('campaigns')}</h2>
        <button type="button" className={replayPrimaryButtonClass} onClick={startCreate} disabled={!version}>
          {t('newCampaign')}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{t('campaignsHint')}</p>
      {campaigns.length === 0 && (
        <p className="text-sm text-gray-500">{t('emptyCampaigns')}</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {campaigns.map((item) => (
          <div key={item.id} className={`${replayCardClass} p-4`}>
            <button type="button" className="w-full text-left" onClick={() => onOpen(item.id)}>
              <h3 className="font-medium">{item.name}</h3>
              <p className="text-sm text-gray-500">{item.instrument || '—'}</p>
              <p className="text-xs text-gray-400">
                {formatDate(item.period_start, preferences.date_format, false, preferences.timezone)}
                {' → '}
                {formatDate(item.period_end, preferences.date_format, false, preferences.timezone)}
              </p>
            </button>
            <div className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
              <Tooltip content={t('edit')} position="top">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                  onClick={() => startEdit(item)}
                  aria-label={t('edit')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip content={t('duplicate')} position="top">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  onClick={() => void duplicateCampaign(item)}
                  aria-label={t('duplicate')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip content={t('delete')} position="top">
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  onClick={() => onDelete(item.id)}
                  aria-label={t('delete')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </Tooltip>
            </div>
          </div>
        ))}
      </div>
      {open && version && (
        <div className={`${replayCardClass} space-y-3 p-4`}>
          <input
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            placeholder={t('name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              {t('instrument')}
              <InstrumentPicker value={instrument} onChange={setInstrument} />
            </label>
            <DateInput value={start} onChange={setStart} />
            <DateInput value={end} onChange={setEnd} />
            <input
              className="rounded-md border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
              value={sessionTz}
              onChange={(event) => setSessionTz(event.target.value)}
              placeholder={t('campaignTimezone')}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={replayPrimaryButtonClass}
              onClick={async () => {
                try {
                  if (editingId) {
                    await backtestJournalService.updateCampaign(editingId, {
                      name: name || t('newCampaign'),
                      instrument,
                      period_start: start,
                      period_end: end,
                      timezone: sessionTz,
                    });
                    toast.success(t('saved'));
                    resetForm();
                    await onCreated();
                  } else {
                    const created = await backtestJournalService.createCampaign({
                      strategy_version: version.id,
                      name: name || t('newCampaign'),
                      instrument,
                      period_start: start,
                      period_end: end,
                      timezone: sessionTz,
                      status: 'IN_PROGRESS',
                    });
                    toast.success(t('saved'));
                    resetForm();
                    await onCreated(created);
                  }
                } catch {
                  toast.error(t('saveError'));
                }
              }}
            >
              {t('save')}
            </button>
            <button type="button" className={replaySecondaryButtonClass} onClick={resetForm}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${replayCardClass} p-4`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function CampaignDashboard({ campaign, nonce }: { campaign: BacktestCampaign; nonce: number }) {
  const { t } = useTranslation('backtestJournal');
  const { preferences } = usePreferences();
  const [stats, setStats] = useState<BacktestMetrics | null>(null);
  const [equity, setEquity] = useState<{ taken: EquityPoint[]; refused_theoretical: EquityPoint[] } | null>(null);
  const [recent, setRecent] = useState<BacktestObservation[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, e, obs] = await Promise.all([
          backtestJournalService.getStatistics(campaign.id),
          backtestJournalService.getEquity(campaign.id),
          backtestJournalService.listObservations(campaign.id),
        ]);
        setStats(s);
        setEquity(e);
        setRecent(obs.slice(-8).reverse());
      } catch {
        toast.error(t('error'));
      }
    })();
  }, [campaign.id, nonce, t]);

  const nf = preferences.number_format;
  const fmtPct = (value: number | null | undefined) =>
    value == null ? t('notApplicable') : `${formatNumber(value * 100, 1, nf)} %`;
  const fmtR = (value: number | null | undefined) =>
    value == null ? t('notApplicable') : formatNumber(value, 2, nf);
  const progress =
    campaign.observation_goal && stats
      ? `${formatNumber(stats.sample_size, 0, nf)} / ${formatNumber(campaign.observation_goal, 0, nf)}`
      : stats
        ? formatNumber(stats.sample_size, 0, nf)
        : '—';

  return (
    <div className="space-y-4">
      <div className={`${replayCardClass} p-4 text-sm text-gray-600 dark:text-gray-300`}>
        <p>
          {campaign.strategy_name} · v{campaign.version_number} · {campaign.instrument}
        </p>
        <p>
          {formatDate(campaign.period_start, preferences.date_format, false, preferences.timezone)}
          {' → '}
          {formatDate(campaign.period_end, preferences.date_format, false, preferences.timezone)}
        </p>
        <p>{t('grossR')}</p>
      </div>
      {stats && (
        <>
          <p className="text-xs text-gray-500">
            {t(`sample.${stats.sample_label}`)} — {t('sample.disclaimer')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t('progress')} value={progress} />
            <MetricCard label={t('winRate')} value={fmtPct(stats.win_rate)} />
            <MetricCard label={t('expectancy')} value={fmtR(stats.expectancy_r)} />
            <MetricCard
              label={t('profitFactor')}
              value={stats.profit_factor_not_applicable ? t('notApplicable') : fmtR(stats.profit_factor)}
            />
            <MetricCard label={t('totalR')} value={fmtR(stats.total_r)} />
            <MetricCard label={t('maxDrawdown')} value={fmtR(stats.max_drawdown_r)} />
            <MetricCard
              label={t('streaks')}
              value={`${formatNumber(stats.max_win_streak, 0, nf)} / ${formatNumber(stats.max_loss_streak, 0, nf)}`}
            />
            <MetricCard
              label={t('acceptance')}
              value={fmtPct(stats.acceptance_rate ?? null)}
              hint={`${formatNumber(stats.trades_taken || 0, 0, nf)} ${t('taken')} · ${formatNumber(stats.setups_refused || 0, 0, nf)} ${t('refused')}`}
            />
          </div>
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${replayCardClass} p-4`}>
          <h3 className="mb-2 text-sm font-medium">{t('equityTaken')}</h3>
          <BacktestEquityChart
            points={equity?.taken || []}
            mode="equity"
            dateFormat={preferences.date_format}
            timezone={preferences.timezone}
            numberFormat={nf}
          />
        </div>
        <div className={`${replayCardClass} p-4`}>
          <h3 className="mb-2 text-sm font-medium">{t('drawdown')}</h3>
          <BacktestEquityChart
            points={equity?.taken || []}
            mode="drawdown"
            dateFormat={preferences.date_format}
            timezone={preferences.timezone}
            numberFormat={nf}
          />
        </div>
      </div>
      <div className={`${replayCardClass} p-4`}>
        <h3 className="mb-2 text-sm font-medium">{t('recent')}</h3>
        <ul className="space-y-1 text-sm">
          {recent.map((obs) => (
            <li key={obs.id} className="flex justify-between tabular-nums">
              <span>
                {formatDateTimeShort(obs.market_datetime, preferences.date_format, preferences.timezone)} · {obs.direction}
                {!obs.trade_taken ? ` · ${t('theoretical')}` : ''}
              </span>
              <span>{obs.result_r != null ? formatNumber(obs.result_r, 2, nf) : '—'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AnalysisView({
  campaign,
}: {
  campaign: BacktestCampaign;
}) {
  const { t } = useTranslation('backtestJournal');
  const { preferences } = usePreferences();
  const nf = preferences.number_format;
  const [filters, setFilters] = useState<AnalysisFilters>({
    group_by: 'direction',
    scope: 'taken',
  });
  const [data, setData] = useState<AnalysisResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await backtestJournalService.getAnalysis(campaign.id, filters));
    } catch {
      toast.error(t('error'));
    }
  }, [campaign.id, filters, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (value: number | null | undefined, digits = 2) =>
    value == null ? t('notApplicable') : formatNumber(value, digits, nf);

  return (
    <div className="space-y-4">
      <div className={`${replayCardClass} grid gap-3 p-4 md:grid-cols-4`}>
        <CustomSelect
          className="w-full"
          value={filters.direction || ''}
          onChange={(value) => setFilters((prev) => ({ ...prev, direction: value ? String(value) : undefined }))}
          options={[
            { value: '', label: t('all') },
            { value: 'LONG', label: t('long') },
            { value: 'SHORT', label: t('short') },
          ]}
        />
        <CustomSelect
          className="w-full"
          value={filters.scope || 'taken'}
          onChange={(value) => setFilters((prev) => ({ ...prev, scope: String(value || 'taken') }))}
          options={[
            { value: 'taken', label: t('scopeTaken') },
            { value: 'refused', label: t('scopeRefused') },
          ]}
        />
        <CustomSelect
          className="w-full"
          value={filters.group_by || 'direction'}
          onChange={(value) => setFilters((prev) => ({ ...prev, group_by: String(value) }))}
          options={[
            { value: 'direction', label: t('groupDirection') },
            { value: 'weekday', label: t('groupWeekday') },
            { value: 'hour', label: t('groupHour') },
          ]}
        />
        <button
          type="button"
          className={`${replaySecondaryButtonClass} w-full`}
          onClick={() => setFilters({ group_by: 'direction', scope: 'taken' })}
        >
          {t('resetFilters')}
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className={replaySecondaryButtonClass}
          onClick={async () => {
            try {
              const blob = await backtestJournalService.exportCsv(campaign.id, { ...filters, selection: false });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${campaign.name}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(t('exportSuccess'));
            } catch {
              toast.error(t('exportError'));
            }
          }}
        >
          {t('exportAll')}
        </button>
        <button
          type="button"
          className={replaySecondaryButtonClass}
          onClick={async () => {
            try {
              const blob = await backtestJournalService.exportCsv(campaign.id, { ...filters, selection: true });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${campaign.name}-selection.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(t('exportSuccess'));
            } catch {
              toast.error(t('exportError'));
            }
          }}
        >
          {t('exportSelection')}
        </button>
      </div>
      {data && (
        <div className={`${replayCardClass} overflow-auto`}>
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">{t('groupBy')}</th>
                <th className="px-3 py-2 text-right tabular-nums">N</th>
                <th className="px-3 py-2 text-right">{t('winRate')}</th>
                <th className="px-3 py-2 text-right">{t('expectancy')}</th>
                <th className="px-3 py-2 text-right">{t('profitFactor')}</th>
                <th className="px-3 py-2 text-right">{t('totalR')}</th>
                <th className="px-3 py-2 text-right">{t('maxDrawdown')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td className="px-3 py-2">{t('all')}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(data.filtered.sample_size, 0, nf)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {data.filtered.win_rate == null ? t('notApplicable') : `${formatNumber(data.filtered.win_rate * 100, 1, nf)} %`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(data.filtered.expectancy_r)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {data.filtered.profit_factor_not_applicable ? t('notApplicable') : fmt(data.filtered.profit_factor)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(data.filtered.total_r)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmt(data.filtered.max_drawdown_r)}</td>
              </tr>
              {data.groups.map((group) => (
                <tr key={group.group} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2">
                    {filters.group_by === 'weekday' ? t(`weekday.${group.group}`) : group.group}
                    <div className="text-[11px] text-gray-500">{t(`sample.${group.sample_label}`)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(group.sample_size, 0, nf)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {group.win_rate == null ? t('notApplicable') : `${formatNumber(group.win_rate * 100, 1, nf)} %`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(group.expectancy_r)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {group.profit_factor_not_applicable ? t('notApplicable') : fmt(group.profit_factor)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(group.total_r)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(group.max_drawdown_r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default BacktestJournalPage;
