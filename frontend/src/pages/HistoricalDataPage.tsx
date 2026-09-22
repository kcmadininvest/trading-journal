import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast/headless';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../components/layout';
import { DateInput } from '../components/common/DateInput';
import { CustomSelect } from '../components/common/CustomSelect';
import { CustomMultiSelect } from '../components/common/CustomMultiSelect';
import { NumberInputStepper } from '../components/common/NumberInputStepper';
import { PaginationControls } from '../components/ui';
import {
  replayCardClass,
  replayDateInputClass,
  replayPrimaryButtonClass,
  replaySecondaryButtonClass,
} from '../components/replay/replayStyles';
import { usePagination } from '../hooks';
import { usePreferences } from '../hooks/usePreferences';
import { DEFAULT_ITEMS_PER_PAGE } from '../hooks/preferencesProvider';
import { formatDate } from '../utils/dateFormat';
import { formatNumber } from '../utils/numberFormat';
import { getTodayDateInTimezone, addCalendarDays } from '../components/replay/replayDateNav';
import { userService } from '../services/userService';
import historicalDataService, {
  CoverageEntry,
  DownloadJob,
  MarketContract,
  MarketInstrument,
  QualityIssue,
  SyncHealth,
  SyncRun,
  SyncRunStatus,
  SyncSettings,
  SyncTarget,
} from '../services/historicalData';

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
/** Fenêtre par défaut : historique TopStepX sim souvent limité au contrat front récent. */
const DEFAULT_LOOKBACK_DAYS = 7;
const SYNC_RUNS_LIMIT = 50;
const SYNC_RUNS_PAGE_SIZE_DEFAULT = 5;
const SYNC_RUNS_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
/** Poll tant que l’onglet Sync est ouvert (découvrir un run démarré hors page). */
const SYNC_STATUS_POLL_MS = 4000;
const SYNC_IDLE_POLL_MS = 15000;

const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

const HistoricalDataPage: React.FC = () => {
  const { t } = useTranslation('historicalData');
  const { preferences, loading: preferencesLoading } = usePreferences();
  const numberFormat = preferences.number_format;
  const dateFormat = preferences.date_format;
  const todayIso = useMemo(
    () => getTodayDateInTimezone(preferences.timezone || 'Europe/Paris'),
    [preferences.timezone],
  );

  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [instrument, setInstrument] = useState('');
  const [contracts, setContracts] = useState<MarketContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractId, setContractId] = useState('');
  const [start, setStart] = useState(() =>
    addCalendarDays(getTodayDateInTimezone('Europe/Paris'), -DEFAULT_LOOKBACK_DAYS),
  );
  const [end, setEnd] = useState(() => getTodayDateInTimezone('Europe/Paris'));
  const [timeframes, setTimeframes] = useState<string[]>(['1m']);
  const [batchJobs, setBatchJobs] = useState<DownloadJob[]>([]);
  const [coverage, setCoverage] = useState<CoverageEntry[]>([]);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [bootLoading, setBootLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [bottomTab, setBottomTab] = useState<'coverage' | 'issues'>('coverage');
  const [pageTab, setPageTab] = useState<'download' | 'sync'>('download');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'with_data' | 'empty'>('with_data');
  const [coveragePageSize, setCoveragePageSize] = useState(
    () => preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE,
  );
  const [exporting, setExporting] = useState(false);
  const [syncSettings, setSyncSettings] = useState<SyncSettings | null>(null);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [syncRunsPageSize, setSyncRunsPageSize] = useState(SYNC_RUNS_PAGE_SIZE_DEFAULT);
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [lastRunDetailOpen, setLastRunDetailOpen] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncHour, setSyncHour] = useState(2);
  const [syncMinute, setSyncMinute] = useState(0);
  const [syncTargets, setSyncTargets] = useState<SyncTarget[]>([]);
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncTargetInstrument, setSyncTargetInstrument] = useState('');
  const [syncTargetTimeframes, setSyncTargetTimeframes] = useState<string[]>(['1m']);

  const busy =
    starting || batchJobs.some((j) => !TERMINAL.has(j.status));
  const activeJobIds = useMemo(
    () => batchJobs.filter((j) => !TERMINAL.has(j.status)).map((j) => j.id),
    [batchJobs],
  );
  const focusJob = useMemo(() => {
    if (batchJobs.length === 0) return null;
    return (
      batchJobs.find((j) => j.status === 'running') ||
      batchJobs.find((j) => j.status === 'pending') ||
      batchJobs[batchJobs.length - 1]
    );
  }, [batchJobs]);
  const batchDoneCount = batchJobs.filter((j) => TERMINAL.has(j.status)).length;

  useEffect(() => {
    setEnd((prev) => (prev > todayIso ? todayIso : prev));
    setStart((prev) => {
      const maxStart = todayIso;
      if (prev > maxStart) {
        return addCalendarDays(todayIso, -DEFAULT_LOOKBACK_DAYS);
      }
      return prev;
    });
  }, [todayIso]);

  useEffect(() => {
    if (start > end) setStart(end);
  }, [start, end]);

  const timeframeOptions = useMemo(
    () => [
      { value: '1m', label: t('timeframes.1m') },
      { value: '2m', label: t('timeframes.2m') },
      { value: '5m', label: t('timeframes.5m') },
      { value: '15m', label: t('timeframes.15m') },
      { value: '30m', label: t('timeframes.30m') },
      { value: '1h', label: t('timeframes.1h') },
      { value: '4h', label: t('timeframes.4h') },
      { value: '1d', label: t('timeframes.1d') },
    ],
    [t],
  );

  const instrumentOptions = useMemo(
    () =>
      instruments.map((i) => ({
        value: i.instrument,
        label: `${i.instrument} — ${i.name}`,
      })),
    [instruments],
  );

  const instrumentLabelByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of instruments) {
      map.set(i.instrument, `${i.instrument} — ${i.name}`);
    }
    return map;
  }, [instruments]);

  const contractOptions = useMemo(
    () => [
      { value: '', label: t('allContracts') },
      ...contracts
        .filter((c) => !instrument || c.instrument === instrument)
        .map((c) => {
          const expiryLabel = c.expiry_date
            ? ` (${t('contractExpiry')}: ${formatDate(c.expiry_date, dateFormat)})`
            : '';
          return {
            value: c.contract_id,
            label: `${c.symbol || c.contract_id}${expiryLabel}`,
          };
        }),
    ],
    [contracts, dateFormat, instrument, t],
  );

  const loadInstruments = useCallback(async () => {
    setBootLoading(true);
    try {
      const list = await historicalDataService.listInstruments();
      setInstruments(list);
      setInstrument((prev) => prev || (list[0]?.instrument ?? ''));
      setSyncTargetInstrument((prev) => prev || (list[0]?.instrument ?? ''));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('loadError');
      toast.error(
        /throttl|trop de téléchargement|too many download/i.test(msg)
          ? t('throttleError')
          : msg,
      );
    } finally {
      setBootLoading(false);
    }
  }, [t]);

  const loadSyncSettings = useCallback(async () => {
    try {
      const data = await historicalDataService.getSyncSettings();
      setSyncSettings(data);
      setSyncEnabled(data.enabled);
      setSyncHour(data.hour);
      setSyncMinute(data.minute);
      setSyncTargets(data.targets || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadSyncRuns = useCallback(async () => {
    try {
      setSyncRuns(await historicalDataService.listSyncRuns(SYNC_RUNS_LIMIT));
    } catch {
      /* ignore */
    }
  }, []);

  const loadSyncHealth = useCallback(async () => {
    try {
      setSyncHealth(await historicalDataService.getSyncHealth());
    } catch {
      /* ignore */
    }
  }, []);

  /** Rafraîchit le statut sans écraser le formulaire en cours d'édition. */
  const refreshSyncStatus = useCallback(async () => {
    try {
      setSyncSettings(await historicalDataService.getSyncSettings());
    } catch {
      /* ignore */
    }
    await loadSyncRuns();
  }, [loadSyncRuns]);

  const loadCoverage = useCallback(async (instr: string) => {
    if (!instr) {
      setCoverage([]);
      return;
    }
    try {
      const data = await historicalDataService.getCoverage(instr);
      setCoverage(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadContracts = useCallback(
    async (instr: string) => {
      if (!instr) {
        setContracts([]);
        setContractId('');
        setContractsLoading(false);
        return;
      }
      setContractsLoading(true);
      try {
        const list = await historicalDataService.listContracts(instr, start, end);
        setContracts(list);
        setContractId((prev) =>
          prev && list.some((c) => c.contract_id === prev) ? prev : '',
        );
      } catch (e) {
        setContracts([]);
        setContractId('');
        toast.error(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setContractsLoading(false);
      }
    },
    [start, end, t],
  );

  useEffect(() => {
    void loadInstruments();
    void loadSyncSettings();
    void loadSyncRuns();
    void loadSyncHealth();
  }, [loadInstruments, loadSyncHealth, loadSyncRuns, loadSyncSettings]);

  const syncStatus = syncSettings?.last_status || '';

  // Tant que l’onglet Sync est visible : rafraîchir sans F5 (y compris pour
  // découvrir un run planifié démarré alors que le statut local était terminal).
  useEffect(() => {
    if (pageTab !== 'sync') return undefined;
    void refreshSyncStatus();
    void loadSyncHealth();
    const intervalMs =
      syncStatus === 'running' ? SYNC_STATUS_POLL_MS : SYNC_IDLE_POLL_MS;
    const timer = window.setInterval(() => {
      void refreshSyncStatus();
      void loadSyncHealth();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [pageTab, syncStatus, refreshSyncStatus, loadSyncHealth]);

  useEffect(() => {
    if (!instrument) return;
    void loadContracts(instrument);
    void loadCoverage(instrument);
  }, [instrument, loadContracts, loadCoverage]);

  const batchBusyRef = useRef(false);

  useEffect(() => {
    if (activeJobIds.length === 0) return undefined;
    const ids = [...activeJobIds];
    let authFailures = 0;
    const timer = window.setInterval(async () => {
      try {
        const updates = await Promise.all(
          ids.map((id) => historicalDataService.getJob(id)),
        );
        authFailures = 0;
        setBatchJobs((prev) => {
          const byId = new Map(prev.map((j) => [j.id, j]));
          for (const updated of updates) {
            byId.set(updated.id, updated);
          }
          return Array.from(byId.values()).sort((a, b) => a.id - b.id);
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'AUTH_REQUIRED') {
          authFailures += 1;
          if (authFailures >= 2) {
            toast.error(t('authExpired'));
            setBatchJobs((prev) =>
              prev.map((j) =>
                TERMINAL.has(j.status)
                  ? j
                  : { ...j, status: 'failed', error: t('authExpired') },
              ),
            );
          }
        }
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [activeJobIds, t]);

  useEffect(() => {
    const isBusy = batchJobs.some((j) => !TERMINAL.has(j.status));
    if (batchBusyRef.current && !isBusy && batchJobs.length > 0) {
      const instr = batchJobs[0]?.instrument;
      void (async () => {
        try {
          const issueLists = await Promise.all(
            batchJobs.map((j) => historicalDataService.getJobIssues(j.id)),
          );
          setIssues(issueLists.flat());
        } catch {
          /* ignore */
        }
        if (instr) void loadCoverage(instr);
      })();

      const failed = batchJobs.filter((j) => j.status === 'failed');
      const completed = batchJobs.filter((j) => j.status === 'completed');
      const total = batchJobs.length;
      if (failed.length === 0) {
        toast.success(t('batchCompleted', { done: completed.length, total }));
      } else if (completed.length === 0) {
        toast.error(
          failed[0]?.error || t('batchFailed', { failed: failed.length, total }),
        );
      } else {
        toast(
          t('batchPartial', {
            done: completed.length,
            failed: failed.length,
            total,
          }),
        );
      }
    }
    batchBusyRef.current = isBusy;
  }, [batchJobs, loadCoverage, t]);

  const handleStart = async () => {
    if (!instrument || !start || !end || timeframes.length === 0) return;
    const endClamped = end > todayIso ? todayIso : end;
    if (endClamped !== end) setEnd(endClamped);
    setStarting(true);
    setIssues([]);
    try {
      const created = await historicalDataService.startDownload({
        instrument,
        contract_id: contractId || undefined,
        timeframes,
        start: `${start}T00:00:00Z`,
        end: `${endClamped}T23:59:59Z`,
      });
      setBatchJobs(created.jobs);
      setBottomTab('coverage');
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('loadError');
      toast.error(
        /throttl|trop de téléchargement|too many download/i.test(msg)
          ? t('throttleError')
          : msg,
      );
    } finally {
      setStarting(false);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      complete: t('statusComplete'),
      partial: t('statusPartial'),
      empty: t('statusEmpty'),
      pending: t('statusPending'),
      running: t('statusRunning'),
      completed: t('statusCompleted'),
      failed: t('statusFailed'),
      cancelled: t('statusFailed'),
    };
    return map[status] || status;
  };

  const syncStatusVisual = useCallback(
    (status: SyncRunStatus | '' | undefined) => {
      switch (status) {
        case 'success':
          return {
            label: t('syncStatusSuccess'),
            className:
              'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
          };
        case 'partial':
          return {
            label: t('syncStatusPartial'),
            className:
              'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          };
        case 'error':
          return {
            label: t('syncStatusError'),
            className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
          };
        case 'up_to_date':
          return {
            label: t('syncStatusUpToDate'),
            className: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-200',
          };
        case 'running':
          return {
            label: t('syncStatusRunning'),
            className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
          };
        default:
          return {
            label: t('syncNeverRun'),
            className: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
          };
      }
    },
    [t],
  );

  const fmtDateTime = useCallback(
    (iso: string | null | undefined) =>
      iso ? formatDate(iso, dateFormat, true, preferences.timezone) : '',
    [dateFormat, preferences.timezone],
  );

  const fmtDuration = useCallback(
    (startIso: string, endIso: string | null) => {
      if (!endIso) return '—';
      const seconds = Math.max(
        0,
        Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000),
      );
      if (seconds < 60) return `${seconds} s`;
      return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
    },
    [],
  );

  const fmtNum = (n: number) => formatNumber(n, 0, numberFormat);
  const fmtDateIso = (iso: string) => {
    try {
      return formatDate(iso.slice(0, 10), dateFormat);
    } catch {
      return iso;
    }
  };

  const coverageFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('coverageFilterAll') },
      { value: 'with_data', label: t('coverageFilterWithData') },
      { value: 'empty', label: t('coverageFilterEmpty') },
    ],
    [t],
  );

  const filteredCoverage = useMemo(() => {
    if (coverageFilter === 'with_data') {
      return coverage.filter((c) => c.bars_stored > 0);
    }
    if (coverageFilter === 'empty') {
      return coverage.filter((c) => c.bars_stored <= 0);
    }
    return coverage;
  }, [coverage, coverageFilter]);

  const {
    currentPage: coveragePage,
    totalPages: coverageTotalPages,
    paginatedItems: paginatedCoverage,
    totalItems: coverageTotalItems,
    goToPage: goToCoveragePage,
    startIndex: coverageStartIndex,
    endIndex: coverageEndIndex,
  } = usePagination(filteredCoverage, {
    itemsPerPage: coveragePageSize,
    initialPage: 1,
  });

  const goToCoveragePageRef = useRef(goToCoveragePage);
  useEffect(() => {
    goToCoveragePageRef.current = goToCoveragePage;
  }, [goToCoveragePage]);

  useEffect(() => {
    if (preferencesLoading) return;
    const prefSize = preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE;
    setCoveragePageSize((prev) => (prev === prefSize ? prev : prefSize));
    goToCoveragePageRef.current(1);
  }, [preferencesLoading, preferences.items_per_page]);

  useEffect(() => {
    goToCoveragePageRef.current(1);
  }, [coverageFilter]);

  useEffect(() => {
    if (coverageTotalPages > 0 && coveragePage > coverageTotalPages) {
      goToCoveragePageRef.current(coverageTotalPages);
    }
  }, [coveragePage, coverageTotalPages]);

  const {
    currentPage: syncRunsPage,
    totalPages: syncRunsTotalPages,
    paginatedItems: paginatedSyncRuns,
    totalItems: syncRunsTotalItems,
    goToPage: goToSyncRunsPage,
    startIndex: syncRunsStartIndex,
    endIndex: syncRunsEndIndex,
  } = usePagination(syncRuns, {
    itemsPerPage: syncRunsPageSize,
    initialPage: 1,
  });

  const goToSyncRunsPageRef = useRef(goToSyncRunsPage);
  useEffect(() => {
    goToSyncRunsPageRef.current = goToSyncRunsPage;
  }, [goToSyncRunsPage]);

  const prevFirstSyncRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    const firstId = syncRuns[0]?.id ?? null;
    if (
      firstId !== null &&
      prevFirstSyncRunIdRef.current !== null &&
      firstId !== prevFirstSyncRunIdRef.current
    ) {
      goToSyncRunsPageRef.current(1);
    }
    prevFirstSyncRunIdRef.current = firstId;
  }, [syncRuns]);

  useEffect(() => {
    if (syncRunsTotalPages > 0 && syncRunsPage > syncRunsTotalPages) {
      goToSyncRunsPageRef.current(syncRunsTotalPages);
    }
  }, [syncRunsPage, syncRunsTotalPages]);

  const handleSyncRunsPageSizeChange = (size: number) => {
    const sanitized =
      Number.isFinite(size) && size > 0 ? size : SYNC_RUNS_PAGE_SIZE_DEFAULT;
    setSyncRunsPageSize(sanitized);
    goToSyncRunsPage(1);
  };

  const handleCoveragePageSizeChange = async (size: number) => {
    const sanitized = Number.isFinite(size) && size > 0 ? size : DEFAULT_ITEMS_PER_PAGE;
    setCoveragePageSize(sanitized);
    goToCoveragePage(1);
    try {
      await userService.updatePreferences({ items_per_page: sanitized });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('[HistoricalDataPage] Failed to persist items_per_page', error);
    }
  };

  const coverageTotals = useMemo(() => {
    return filteredCoverage.reduce(
      (acc, row) => {
        acc.stored += row.bars_stored;
        acc.expected += row.bars_expected;
        acc.missing += row.unexpected_missing_count;
        if (row.status === 'complete') acc.complete += 1;
        else if (row.status === 'partial') acc.partial += 1;
        return acc;
      },
      { stored: 0, expected: 0, missing: 0, complete: 0, partial: 0 },
    );
  }, [filteredCoverage]);

  const handleExportCsv = async () => {
    if (!instrument || !start || !end || timeframes.length === 0) return;
    setExporting(true);
    try {
      for (const tf of timeframes) {
        const blob = await historicalDataService.exportBarsCsv({
          instrument,
          timeframe: tf,
          start: `${start}T00:00:00Z`,
          end: `${end}T23:59:59Z`,
          contract_id: contractId || undefined,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${instrument}_${tf}_${start}_${end}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      toast.success(
        timeframes.length === 1
          ? t('exportSuccess')
          : t('exportSuccessMulti', { count: timeframes.length }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('exportError'));
    } finally {
      setExporting(false);
    }
  };

  const syncProfileDirty = useMemo(() => {
    if (!syncSettings) return false;
    if (syncEnabled !== syncSettings.enabled) return true;
    if (syncHour !== syncSettings.hour) return true;
    if (syncMinute !== syncSettings.minute) return true;
    const saved = syncSettings.targets || [];
    if (syncTargets.length !== saved.length) return true;
    return syncTargets.some((tg, i) => {
      const s = saved[i];
      return (
        tg.instrument !== s.instrument ||
        tg.timeframe !== s.timeframe ||
        (tg.contract_id || '') !== (s.contract_id || '')
      );
    });
  }, [syncSettings, syncEnabled, syncHour, syncMinute, syncTargets]);

  const applySyncSettingsToForm = useCallback((data: SyncSettings) => {
    setSyncSettings(data);
    setSyncEnabled(data.enabled);
    setSyncHour(data.hour);
    setSyncMinute(data.minute);
    setSyncTargets(data.targets || []);
  }, []);

  const handleSaveSync = async () => {
    if (!syncProfileDirty) return;
    setSyncSaving(true);
    try {
      const updated = await historicalDataService.updateSyncSettings({
        enabled: syncEnabled,
        hour: syncHour,
        minute: syncMinute,
        targets: syncTargets.map((tg, idx) => ({
          instrument: tg.instrument,
          timeframe: tg.timeframe,
          contract_id: tg.contract_id || '',
          ordering: idx,
        })),
      });
      applySyncSettingsToForm(updated);
      toast.success(t('syncSaved'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('syncSaveError'));
    } finally {
      setSyncSaving(false);
    }
  };

  const handleRunSyncNow = async () => {
    setSyncRunning(true);
    try {
      await historicalDataService.updateSyncSettings({
        enabled: syncEnabled,
        hour: syncHour,
        minute: syncMinute,
        targets: syncTargets.map((tg, idx) => ({
          instrument: tg.instrument,
          timeframe: tg.timeframe,
          contract_id: tg.contract_id || '',
          ordering: idx,
        })),
      });
      const result = await historicalDataService.runSyncNow();
      applySyncSettingsToForm(result.settings);
      await loadSyncRuns();
      goToSyncRunsPage(1);
      if (result.jobs?.length) {
        setBatchJobs(result.jobs);
        toast.success(t('syncRunStarted'));
      } else {
        toast.success(result.settings.last_error || t('syncNothingToDo'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('syncRunError'));
    } finally {
      setSyncRunning(false);
    }
  };

  /** Aligné sur l’agrégation backend : empty ≠ échec ; pending/running ≠ échec. */
  const summarizeRun = useCallback((run: SyncRun) => {
    const groups = new Map<string, string[]>();
    let ok = 0;
    let pending = 0;
    let failed = 0;
    for (const job of run.jobs || []) {
      const label = `${job.instrument} ${job.timeframe}`;
      if (job.status === 'pending' || job.status === 'running') {
        pending += 1;
        continue;
      }
      if (job.status === 'completed') {
        ok += 1;
        continue;
      }
      // failed / cancelled — échecs durs uniquement dans le détail
      failed += 1;
      const message = job.error || job.status;
      const existing = groups.get(message);
      if (existing) existing.push(label);
      else groups.set(message, [label]);
    }
    const total = (run.jobs || []).length;
    return {
      total,
      ok,
      pending,
      failed,
      groups: Array.from(groups.entries()).map(([message, targets]) => ({ message, targets })),
    };
  }, []);

  const renderRunDetail = useCallback(
    (run: SyncRun) => {
      const { groups } = summarizeRun(run);
      if (groups.length === 0) {
        return run.error ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{run.error}</p>
        ) : null;
      }
      return (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.message} className="flex flex-col gap-1">
              <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                {group.message}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.targets.map((target) => (
                  <span
                    key={target}
                    className="inline-flex items-center rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900/40 dark:text-gray-200 dark:ring-gray-700"
                  >
                    {target}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      );
    },
    [summarizeRun],
  );

  const latestRun = syncRuns[0] ?? null;
  const latestSummary = useMemo(
    () =>
      latestRun
        ? summarizeRun(latestRun)
        : { total: 0, ok: 0, pending: 0, failed: 0, groups: [] },
    [latestRun, summarizeRun],
  );
  const lastRunStatus = syncSettings?.last_status || latestRun?.status || '';
  const lastRunDatetime = fmtDateTime(
    syncSettings?.last_finished_at || latestRun?.finished_at || syncSettings?.last_run_at,
  );

  const timeframeOrder = useMemo(
    () => new Map(timeframeOptions.map((opt, idx) => [opt.value, idx])),
    [timeframeOptions],
  );

  const syncTargetGroups = useMemo(() => {
    const groups = new Map<
      string,
      { instrument: string; contract_id: string; timeframes: string[] }
    >();
    for (const tg of syncTargets) {
      const contractId = tg.contract_id || '';
      const key = `${tg.instrument}\0${contractId}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.timeframes.includes(tg.timeframe)) {
          existing.timeframes.push(tg.timeframe);
        }
      } else {
        groups.set(key, {
          instrument: tg.instrument,
          contract_id: contractId,
          timeframes: [tg.timeframe],
        });
      }
    }
    return Array.from(groups.values()).map((group) => ({
      ...group,
      timeframes: [...group.timeframes].sort(
        (a, b) => (timeframeOrder.get(a) ?? 999) - (timeframeOrder.get(b) ?? 999),
      ),
    }));
  }, [syncTargets, timeframeOrder]);

  const addSyncTarget = () => {
    const instr = (syncTargetInstrument || instrument || '').toUpperCase();
    if (!instr) return;
    if (syncTargetTimeframes.length === 0) {
      toast.error(t('syncSelectTimeframes'));
      return;
    }
    const toAdd: SyncTarget[] = [];
    for (const tf of syncTargetTimeframes) {
      const exists = syncTargets.some(
        (tg) =>
          tg.instrument === instr &&
          tg.timeframe === tf &&
          !(tg.contract_id || ''),
      );
      if (!exists) {
        toAdd.push({ instrument: instr, timeframe: tf, contract_id: '' });
      }
    }
    if (toAdd.length === 0) {
      toast.error(t('syncTargetExists'));
      return;
    }
    setSyncTargets((prev) => [...prev, ...toAdd]);
  };

  const removeSyncTargetGroup = (instrument: string, contractId: string) => {
    setSyncTargets((prev) =>
      prev.filter(
        (tg) => !(tg.instrument === instrument && (tg.contract_id || '') === contractId),
      ),
    );
  };

  const updateSyncTargetGroupTimeframes = (
    instrument: string,
    contractId: string,
    nextTimeframes: string[],
  ) => {
    if (nextTimeframes.length === 0) {
      toast.error(t('syncSelectTimeframes'));
      return;
    }
    const unique = [...new Set(nextTimeframes)];
    setSyncTargets((prev) => {
      const result: SyncTarget[] = [];
      let inserted = false;
      for (const tg of prev) {
        const same =
          tg.instrument === instrument && (tg.contract_id || '') === contractId;
        if (!same) {
          result.push(tg);
          continue;
        }
        if (!inserted) {
          for (const tf of unique) {
            result.push({
              instrument,
              timeframe: tf,
              contract_id: contractId,
            });
          }
          inserted = true;
        }
      }
      return result;
    });
  };

  return (
    <PageShell>
      <div className="mb-4 sm:mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label={t('pageTabsAria')}>
            {(
              [
                { id: 'download' as const, label: t('downloadTab') },
                { id: 'sync' as const, label: t('syncTab') },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPageTab(tab.id)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  pageTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                aria-current={pageTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
                {tab.id === 'sync' && syncEnabled ? ` · ${t('syncOn')}` : ''}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {pageTab === 'sync' ? (
        bootLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
            </div>
          </div>
        ) : (
          <div className={`${replayCardClass} p-4 sm:p-5`}>
            <div className="flex min-w-0 flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                  {t('syncTitle')}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('syncSubtitle')}</p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={syncEnabled}
                onClick={() => setSyncEnabled((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                  syncEnabled
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                    : 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/40'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                    {t('syncEnabled')}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs font-medium ${
                      syncEnabled
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {syncEnabled ? t('syncToggleOn') : t('syncToggleOff')}
                  </span>
                </span>
                <span
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                    syncEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      syncEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-md">
                <div>
                  <label className={labelClass} htmlFor="historical-sync-hour">
                    {t('syncHour')}
                  </label>
                  <NumberInputStepper
                    id="historical-sync-hour"
                    min={0}
                    max={23}
                    step={1}
                    digits={0}
                    padLength={2}
                    value={syncHour}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      setSyncHour(Number.isNaN(n) ? 0 : Math.min(23, Math.max(0, n)));
                    }}
                    inputClassName={replayDateInputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="historical-sync-minute">
                    {t('syncMinute')}
                  </label>
                  <NumberInputStepper
                    id="historical-sync-minute"
                    min={0}
                    max={59}
                    step={1}
                    digits={0}
                    padLength={2}
                    value={syncMinute}
                    onChange={(v) => {
                      const n = parseInt(v, 10);
                      setSyncMinute(Number.isNaN(n) ? 0 : Math.min(59, Math.max(0, n)));
                    }}
                    inputClassName={replayDateInputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('syncTimezoneHint', { timezone: preferences.timezone || 'Europe/Paris' })}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="min-w-0">
                  <label className={labelClass}>{t('instrument')}</label>
                  <CustomSelect
                    className="w-full"
                    value={syncTargetInstrument || null}
                    onChange={(value) => setSyncTargetInstrument(value ? String(value) : '')}
                    options={instrumentOptions}
                    searchable
                    placeholder={t('instrumentPlaceholder')}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelClass}>{t('timeframesLabel')}</label>
                  <CustomMultiSelect
                    className="w-full"
                    value={syncTargetTimeframes}
                    onChange={setSyncTargetTimeframes}
                    options={timeframeOptions}
                    placeholder={t('syncTimeframesPlaceholder')}
                    clearLabel={t('syncTimeframesClear')}
                    selectedCountLabel={(count) => t('syncTimeframesCount', { count })}
                  />
                </div>
                <button type="button" onClick={addSyncTarget} className={replaySecondaryButtonClass}>
                  {t('syncAddTarget')}
                </button>
              </div>

              {syncTargetGroups.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('syncNoTargets')}</p>
              ) : (
                <ul className="divide-y divide-gray-200 dark:divide-gray-700 rounded-md border border-gray-200 dark:border-gray-700">
                  {syncTargetGroups.map((group) => (
                    <li
                      key={`${group.instrument}-${group.contract_id}`}
                      className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm sm:flex-nowrap"
                    >
                      <span className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-gray-100">
                        {instrumentLabelByCode.get(group.instrument) || group.instrument}
                        <span className="mt-0.5 block font-normal text-gray-600 dark:text-gray-400">
                          {group.contract_id || t('allContracts')}
                        </span>
                      </span>
                      <div
                        className="min-w-0 w-full sm:w-56 sm:flex-none"
                        title={t('syncEditTarget')}
                      >
                        <span className="sr-only">
                          {t('syncEditTarget')} —{' '}
                          {instrumentLabelByCode.get(group.instrument) || group.instrument}
                        </span>
                        <CustomMultiSelect
                          className="w-full"
                          value={group.timeframes}
                          onChange={(next) =>
                            updateSyncTargetGroupTimeframes(
                              group.instrument,
                              group.contract_id,
                              next,
                            )
                          }
                          options={timeframeOptions}
                          placeholder={t('syncTimeframesPlaceholder')}
                          clearLabel={t('syncTimeframesClear')}
                          selectedCountLabel={(count) => t('syncTimeframesCount', { count })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removeSyncTargetGroup(group.instrument, group.contract_id)
                        }
                        className="ml-auto p-1.5 rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300 sm:ml-0"
                        title={t('syncRemoveTarget')}
                        aria-label={t('syncRemoveTarget')}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveSync()}
                  disabled={syncSaving || bootLoading || !syncProfileDirty}
                  className={replayPrimaryButtonClass}
                >
                  {syncSaving ? t('loading') : t('syncSave')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRunSyncNow()}
                  disabled={syncRunning || bootLoading || syncTargets.length === 0}
                  className={replaySecondaryButtonClass}
                >
                  {syncRunning ? t('downloading') : t('syncRunNow')}
                </button>
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {t('syncLastRunTitle')}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          syncStatusVisual(lastRunStatus).className
                        }`}
                      >
                        {syncStatusVisual(lastRunStatus).label}
                      </span>
                    </div>
                    {lastRunDatetime ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {lastRunDatetime}
                      </span>
                    ) : null}
                  </div>

                  {latestRun ? (
                    <>
                      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { key: 'bars', label: t('syncRunsBars'), value: fmtNum(latestRun.bars_fetched_total) },
                          {
                            key: 'ok',
                            label: t('syncRunsTargetsOk'),
                            value: `${fmtNum(latestSummary.ok)} / ${fmtNum(latestSummary.total)}`,
                          },
                          latestSummary.pending > 0
                            ? {
                                key: 'pending',
                                label: t('syncRunsTargetsPending'),
                                value: fmtNum(latestSummary.pending),
                              }
                            : {
                                key: 'failed',
                                label: t('syncRunsTargetsFailed'),
                                value: fmtNum(latestSummary.failed),
                              },
                          {
                            key: 'duration',
                            label: t('syncRunsDuration'),
                            value: fmtDuration(latestRun.started_at, latestRun.finished_at),
                          },
                        ].map((stat) => (
                          <div key={stat.key} className="min-w-0">
                            <dt className="text-xs text-gray-500 dark:text-gray-400">
                              {stat.label}
                            </dt>
                            <dd className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {stat.value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {latestSummary.groups.length > 0 || latestRun.error ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setLastRunDetailOpen((prev) => !prev)}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {lastRunDetailOpen ? t('syncRunsDetailsHide') : t('syncRunsDetails')}
                          </button>
                          {lastRunDetailOpen ? (
                            <div className="mt-2">{renderRunDetail(latestRun)}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : syncSettings?.last_error ? (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                      {syncSettings.last_error}
                    </p>
                  ) : null}
                </div>

                {syncHealth ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {t('syncHealthTitle')}:
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        syncHealth.scheduler_ok
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          syncHealth.scheduler_ok ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        aria-hidden
                      />
                      {t('syncHealthTick')}:{' '}
                      {syncHealth.scheduler_last_tick_at
                        ? syncHealth.scheduler_ok
                          ? t('syncHealthTickOk', {
                              datetime: fmtDateTime(syncHealth.scheduler_last_tick_at),
                            })
                          : t('syncHealthTickStale', {
                              datetime: fmtDateTime(syncHealth.scheduler_last_tick_at),
                              minutes: syncHealth.scheduler_stale_after_minutes,
                            })
                        : t('syncHealthTickNever')}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700/50 dark:text-gray-200">
                      {t('syncHealthWorker')}:{' '}
                      {syncHealth.celery_workers_available
                        ? t('syncHealthWorkerCelery')
                        : t('syncHealthWorkerThread')}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('syncRunsTitle')}
                </h3>
                {syncRuns.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('syncRunsEmpty')}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                      {paginatedSyncRuns.map((run) => {
                        const summary = summarizeRun(run);
                        const expanded = expandedRunId === run.id;
                        const hasDetail = summary.groups.length > 0 || Boolean(run.error);
                        return (
                          <li key={run.id} className="text-sm">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRunId((prev) => (prev === run.id ? null : run.id))
                              }
                              disabled={!hasDetail}
                              className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-gray-800/40"
                            >
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  syncStatusVisual(run.status).className
                                }`}
                              >
                                {syncStatusVisual(run.status).label}
                              </span>
                              <span className="text-xs text-gray-700 dark:text-gray-200">
                                {fmtDateTime(run.started_at)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {run.trigger === 'manual'
                                  ? t('syncRunsTriggerManual')
                                  : t('syncRunsTriggerScheduled')}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {fmtDuration(run.started_at, run.finished_at)}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-gray-300">
                                {t('syncRunsBars')}: {fmtNum(run.bars_fetched_total)}
                              </span>
                              {summary.pending > 0 ? (
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                  {t('syncRunsPendingCount', { count: summary.pending })}
                                </span>
                              ) : null}
                              {summary.failed > 0 ? (
                                <span className="text-xs font-medium text-rose-700 dark:text-rose-400">
                                  {t('syncRunsFailedCount', { count: summary.failed })}
                                </span>
                              ) : null}
                              {hasDetail ? (
                                <svg
                                  className={`ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                                    expanded ? 'rotate-180' : ''
                                  }`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  aria-hidden
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              ) : null}
                            </button>
                            {expanded ? (
                              <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/40">
                                {renderRunDetail(run)}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {syncRunsTotalItems > SYNC_RUNS_PAGE_SIZE_DEFAULT ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
                        <PaginationControls
                          currentPage={syncRunsPage}
                          totalPages={syncRunsTotalPages}
                          totalItems={syncRunsTotalItems}
                          itemsPerPage={syncRunsPageSize}
                          startIndex={syncRunsStartIndex}
                          endIndex={syncRunsEndIndex}
                          onPageChange={goToSyncRunsPage}
                          onPageSizeChange={handleSyncRunsPageSizeChange}
                          pageSizeOptions={SYNC_RUNS_PAGE_SIZE_OPTIONS}
                          className="border-t-0"
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <div className={`${replayCardClass} p-3 sm:p-4 mb-4 sm:mb-6`}>
            <div className="flex min-w-0 flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                  <label className={labelClass}>{t('instrument')}</label>
                  <CustomSelect
                    className="w-full"
                    value={instrument || null}
                    onChange={(value) => {
                      const next = value ? String(value) : '';
                      setInstrument(next);
                      setContractId('');
                      setContracts([]);
                      if (!next) {
                        setCoverage([]);
                      }
                    }}
                    options={instrumentOptions}
                    placeholder={t('instrumentPlaceholder')}
                    searchable
                    searchPlaceholder={t('instrumentPlaceholder')}
                    disabled={bootLoading}
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>{t('contract')}</label>
                  <CustomSelect
                    className="w-full"
                    value={contractId}
                    onChange={(value) => setContractId(value == null ? '' : String(value))}
                    options={contractOptions}
                    disabled={bootLoading || !instrument || contractsLoading}
                    searchable={contracts.length > 8}
                    searchPlaceholder={t('instrumentPlaceholder')}
                    placeholder={
                      !instrument
                        ? t('contractNeedsInstrument')
                        : contractsLoading
                          ? t('loading')
                          : t('allContracts')
                    }
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>{t('timeframesLabel')}</label>
                  <CustomMultiSelect
                    className="w-full"
                    value={timeframes}
                    onChange={setTimeframes}
                    options={timeframeOptions}
                    disabled={bootLoading}
                    placeholder={t('syncTimeframesPlaceholder')}
                    clearLabel={t('syncTimeframesClear')}
                    selectedCountLabel={(count) => t('syncTimeframesCount', { count })}
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>{t('startDate')}</label>
                  <DateInput
                    value={start}
                    onChange={(value) => {
                      const next = value > todayIso ? todayIso : value;
                      setStart(next);
                      if (next > end) setEnd(next);
                    }}
                    className={replayDateInputClass}
                    size="sm"
                    max={end || todayIso}
                  />
                </div>

                <div className="min-w-0">
                  <label className={labelClass}>{t('endDate')}</label>
                  <DateInput
                    value={end}
                    onChange={(value) => setEnd(value > todayIso ? todayIso : value)}
                    className={replayDateInputClass}
                    size="sm"
                    min={start || undefined}
                    max={todayIso}
                  />
                </div>
              </div>

              <div className="flex w-full flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={!instrument || bootLoading || starting || timeframes.length === 0}
                  className={replayPrimaryButtonClass}
                >
                  {starting
                    ? t('downloading')
                    : busy
                      ? t('restartDownload')
                      : t('startDownload')}
                </button>
                <button
                  type="button"
                  onClick={() => void loadCoverage(instrument)}
                  disabled={!instrument || bootLoading}
                  className={replaySecondaryButtonClass}
                >
                  {t('refresh')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportCsv()}
                  disabled={!instrument || bootLoading || exporting || timeframes.length === 0}
                  className={replaySecondaryButtonClass}
                >
                  {exporting ? t('exporting') : t('exportCsv')}
                </button>
              </div>
            </div>
          </div>

          {bootLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <StatCard label={t('barsStored')} value={fmtNum(coverageTotals.stored)} />
                <StatCard label={t('barsExpected')} value={fmtNum(coverageTotals.expected)} />
                <StatCard label={t('missing')} value={fmtNum(coverageTotals.missing)} />
                <StatCard label={t('statusComplete')} value={fmtNum(coverageTotals.complete)} />
                <StatCard label={t('statusPartial')} value={fmtNum(coverageTotals.partial)} />
              </div>

              {focusJob && (
                <div className={`${replayCardClass} p-4 sm:p-5`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        {t('status')}
                        {batchJobs.length > 1
                          ? ` · ${t('batchProgress', {
                              done: batchDoneCount,
                              total: batchJobs.length,
                            })}`
                          : ''}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {statusLabel(focusJob.status)}
                        {focusJob.timeframe ? ` · ${focusJob.timeframe}` : ''}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                      <p>
                        {t('barsFetched')}:{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {fmtNum(focusJob.bars_fetched)}
                        </span>
                      </p>
                      <p>
                        {t('chunksDone')}:{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {fmtNum(focusJob.chunks_done)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all"
                      style={{ width: `${focusJob.progress_pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t('progress')}: {fmtNum(focusJob.progress_pct)}%
                  </p>
                  {batchJobs.length > 1 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {batchJobs.map((j) => (
                        <li key={j.id}>
                          <JobStatusChip
                            timeframe={j.timeframe}
                            status={j.status}
                            label={statusLabel(j.status)}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {focusJob.error && (
                    <p
                      className={`mt-3 text-sm ${
                        focusJob.status === 'failed'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {focusJob.status === 'failed' ? t('error') : t('warning')}: {focusJob.error}
                    </p>
                  )}
                </div>
              )}

              <div className={`${replayCardClass} p-4 sm:p-5`}>
                <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                  <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Historical coverage tabs">
                    {(
                      [
                        { id: 'coverage' as const, label: t('coverage') },
                        { id: 'issues' as const, label: t('issues') },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setBottomTab(tab.id)}
                        className={`whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                          bottomTab === tab.id
                            ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                        aria-current={bottomTab === tab.id ? 'page' : undefined}
                      >
                        {tab.label}
                        {tab.id === 'issues' && issues.length > 0 ? ` (${issues.length})` : ''}
                      </button>
                    ))}
                  </nav>
                </div>

                {bottomTab === 'coverage' ? (
                  coverage.length === 0 ? (
                    <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
                      {t('noCoverage')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="max-w-xs">
                        <label className={labelClass}>{t('coverageFilter')}</label>
                        <CustomSelect
                          className="w-full"
                          value={coverageFilter}
                          onChange={(value) =>
                            setCoverageFilter(
                              (value === 'with_data' || value === 'empty' ? value : 'all'),
                            )
                          }
                          options={coverageFilterOptions}
                        />
                      </div>
                      {filteredCoverage.length === 0 ? (
                        <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
                          {t('noCoverageFiltered')}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                              <tr>
                                <th className="py-2 pr-4 font-medium">{t('contract')}</th>
                                <th className="py-2 pr-4 font-medium">{t('timeframe')}</th>
                                <th className="py-2 pr-4 font-medium">{t('status')}</th>
                                <th className="py-2 pr-4 font-medium">{t('barsStored')}</th>
                                <th className="py-2 pr-4 font-medium">{t('barsExpected')}</th>
                                <th className="py-2 pr-4 font-medium">{t('missing')}</th>
                                <th className="py-2 font-medium">{t('range')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedCoverage.map((c) => (
                                <tr
                                  key={`${c.contract_id}-${c.timeframe}-${c.start_utc}`}
                                  className="border-b border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                  <td className="py-2.5 pr-4 whitespace-nowrap">{c.contract_id}</td>
                                  <td className="py-2.5 pr-4 whitespace-nowrap">{c.timeframe}</td>
                                  <td className="py-2.5 pr-4">
                                    <StatusBadge status={c.status} label={statusLabel(c.status)} />
                                  </td>
                                  <td className="py-2.5 pr-4">{fmtNum(c.bars_stored)}</td>
                                  <td className="py-2.5 pr-4">{fmtNum(c.bars_expected)}</td>
                                  <td className="py-2.5 pr-4">
                                    {fmtNum(c.unexpected_missing_count)}
                                  </td>
                                  <td className="py-2.5 whitespace-nowrap">
                                    {fmtDateIso(c.start_utc)} → {fmtDateIso(c.end_utc)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                ) : issues.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 py-4 text-center">
                    {t('noIssues')}
                  </p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                    {issues.slice(0, 100).map((iss) => (
                      <li
                        key={iss.id}
                        className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2 text-gray-700 dark:text-gray-300"
                      >
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {iss.issue_type}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400"> · {iss.severity}</span>
                        {iss.timestamp_utc ? (
                          <span className="block sm:inline sm:before:content-['·_'] text-gray-500 dark:text-gray-400">
                            {iss.timestamp_utc}
                          </span>
                        ) : null}
                        {iss.contract_id ? (
                          <span className="block sm:inline sm:before:content-['·_'] text-gray-500 dark:text-gray-400">
                            {iss.contract_id}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {bottomTab === 'coverage' && filteredCoverage.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
                  <PaginationControls
                    currentPage={coveragePage}
                    totalPages={coverageTotalPages}
                    totalItems={coverageTotalItems}
                    itemsPerPage={coveragePageSize}
                    startIndex={coverageStartIndex}
                    endIndex={coverageEndIndex}
                    onPageChange={goToCoveragePage}
                    onPageSizeChange={handleCoveragePageSizeChange}
                    pageSizeOptions={[5, 10, 25, 50, 100]}
                    className="border-t-0"
                  />
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={`${replayCardClass} p-4`}>
    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{value}</p>
  </div>
);

const jobStatusTone = (status: string): string => {
  switch (status) {
    case 'running':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
    case 'completed':
      return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'failed':
    case 'cancelled':
      return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    case 'pending':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
};

const JobStatusChip: React.FC<{ timeframe: string; status: string; label: string }> = ({
  timeframe,
  status,
  label,
}) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${jobStatusTone(status)}`}
  >
    {timeframe}
    <span className="mx-1 opacity-50" aria-hidden>
      ·
    </span>
    {label}
  </span>
);

const StatusBadge: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const tone =
    status === 'complete'
      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      : status === 'partial'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
};

export default HistoricalDataPage;
