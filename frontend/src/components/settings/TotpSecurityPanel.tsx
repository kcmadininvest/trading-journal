import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSecurityStatus, userService } from '../../services/userService';
import { SettingsInput } from './SettingsInput';
import { SettingsSection } from './SettingsSection';

type TotpPhase = 'idle' | 'pending' | 'step1' | 'step2' | 'step3' | 'active';

interface Props {
  status: AccountSecurityStatus | null;
  loading: boolean;
  setLoading: (value: boolean) => void;
  showMessage: (type: 'success' | 'error', text: string) => void;
  onStatusChange: (status?: AccountSecurityStatus) => Promise<void> | void;
}

function downloadBackupCodes(codes: string[], filename: string) {
  const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TotpSecurityPanel: React.FC<Props> = ({
  status,
  loading,
  setLoading,
  showMessage,
  onStatusChange,
}) => {
  const { t } = useTranslation('settings');
  const [phase, setPhase] = useState<TotpPhase>('idle');
  const [totpPassword, setTotpPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_data_url: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  useEffect(() => {
    if (!status) return;
    if (backupCodes && backupCodes.length > 0) {
      setPhase('step3');
      return;
    }
    if (status.totp_enabled) {
      setPhase('active');
      return;
    }
    if (totpSetup) {
      setPhase('step2');
      return;
    }
    if (status.totp_pending) {
      setPhase((current) => (current === 'step1' || current === 'step2' ? current : 'pending'));
      return;
    }
    setPhase((current) => (current === 'step1' ? current : 'idle'));
  }, [status, totpSetup, backupCodes]);

  const clearTotpSecrets = useCallback((opts?: { keepPassword?: boolean }) => {
    if (!opts?.keepPassword) setTotpPassword('');
    setCode('');
  }, []);

  const runTotp = async (
    fn: () => Promise<void>,
    opts?: { keepPassword?: boolean; skipReload?: boolean },
  ) => {
    setLoading(true);
    setTotpError('');
    try {
      await fn();
      clearTotpSecrets({ keepPassword: opts?.keepPassword });
      if (!opts?.skipReload) {
        await onStatusChange();
      }
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : t('securityActionError');
      setTotpError(text);
      showMessage('error', text);
    } finally {
      setLoading(false);
    }
  };

  const requireTotpPassword = (): boolean => {
    if (totpPassword.trim()) return true;
    const msg = t('totpPasswordRequired');
    setTotpError(msg);
    showMessage('error', msg);
    return false;
  };

  const requireCode = (): boolean => {
    if (code.trim()) return true;
    const msg = t('totpCodeRequired');
    setTotpError(msg);
    showMessage('error', msg);
    return false;
  };

  const startSetup = () => {
    if (!requireTotpPassword()) return;
    void runTotp(
      async () => {
        const setup = await userService.beginTotp(totpPassword);
        setTotpSetup({ secret: setup.secret, qr_data_url: setup.qr_data_url });
        setBackupCodes(null);
        setPhase('step2');
        showMessage('success', t('totpSetupStarted'));
      },
      { keepPassword: true },
    );
  };

  const confirmSetup = () => {
    if (!requireTotpPassword() || !requireCode()) return;
    void runTotp(async () => {
      const result = await userService.confirmTotp(totpPassword, code);
      setBackupCodes(result.backup_codes);
      setTotpSetup(null);
      setPhase('step3');
      if (result.status) await onStatusChange(result.status);
      showMessage('success', t('totpEnabled'));
    });
  };

  const cancelPending = () => {
    if (!requireTotpPassword()) return;
    void runTotp(async () => {
      const next = await userService.cancelPendingTotp(totpPassword);
      setTotpSetup(null);
      setBackupCodes(null);
      setPhase('idle');
      if (next) await onStatusChange(next);
      showMessage('success', t('totpPendingCancelled'));
    });
  };

  const finishBackupStep = () => {
    setBackupCodes(null);
    clearTotpSecrets();
    setPhase(status?.totp_enabled ? 'active' : 'idle');
  };

  const copyBackupCodes = async () => {
    if (!backupCodes?.length) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      showMessage('success', t('backupCodesCopied'));
    } catch {
      showMessage('error', t('backupCodesCopyFailed'));
    }
  };

  const renderBackupCodes = () => (
    <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700">
      <p className="text-xs font-medium mb-2 text-amber-950 dark:text-amber-100">
        {t('backupCodesRevealOnce')}
      </p>
      <p className="text-xs text-amber-900 dark:text-amber-200 mb-3">{t('backupCodesAlreadyActive')}</p>
      <ul className="grid grid-cols-2 gap-1 font-mono text-sm font-semibold text-gray-900 dark:text-gray-50 mb-3">
        {backupCodes?.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyBackupCodes()}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg"
        >
          {t('backupCodesCopy')}
        </button>
        <button
          type="button"
          onClick={() =>
            downloadBackupCodes(backupCodes || [], 'trading-journal-backup-codes.txt')
          }
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium rounded-lg"
        >
          {t('backupCodesDownload')}
        </button>
      </div>
    </div>
  );

  return (
    <SettingsSection
      title={t('totpTitle')}
      description={t('totpDesc')}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      }
    >
      {phase === 'idle' && (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('totpInactive')}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('totpIdleHint')}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setTotpError('');
              setPhase('step1');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {t('totpActivateCta')}
          </button>
        </>
      )}

      {phase === 'pending' && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {t('totpPendingBanner')}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('totpPendingRestartHint')}</p>
          <SettingsInput
            label={t('currentPassword')}
            type="password"
            value={totpPassword}
            onChange={setTotpPassword}
          />
          {totpError && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
            >
              {totpError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={startSetup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('totpPendingRestart')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={cancelPending}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium rounded-lg disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
            >
              {t('totpPendingCancel')}
            </button>
          </div>
        </div>
      )}

      {phase === 'step1' && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('totpStepOf', { current: 1, total: 3 })}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('totpStep1Hint')}</p>
          <SettingsInput
            label={t('currentPassword')}
            type="password"
            value={totpPassword}
            onChange={setTotpPassword}
          />
          {totpError && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
            >
              {totpError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={startSetup}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('totpContinue')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                clearTotpSecrets();
                setTotpError('');
                setPhase(status?.totp_pending ? 'pending' : 'idle');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium rounded-lg disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {phase === 'step2' && totpSetup && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('totpStepOf', { current: 2, total: 3 })}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('totpStep2Hint')}</p>
          <img
            src={totpSetup.qr_data_url}
            alt="QR 2FA"
            className="w-48 h-48 bg-white p-2 rounded"
          />
          <p className="text-xs text-gray-600 dark:text-gray-300">{t('totpManualSecret')}</p>
          <code className="block rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 font-mono text-sm font-semibold tracking-wide break-all text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50">
            {totpSetup.secret}
          </code>
          <SettingsInput
            label={t('totpCodeOnly')}
            type="text"
            value={code}
            onChange={setCode}
          />
          {totpError && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
            >
              {totpError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={confirmSetup}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('totpActivateConfirm')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setTotpSetup(null);
                setCode('');
                setTotpError('');
                setPhase('pending');
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 text-sm font-medium rounded-lg disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {phase === 'step3' && backupCodes && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('totpStepOf', { current: 3, total: 3 })}
          </p>
          {renderBackupCodes()}
          <button
            type="button"
            disabled={loading}
            onClick={finishBackupStep}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {t('backupCodesSavedCta')}
          </button>
        </div>
      )}

      {phase === 'active' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('totpActive', { remaining: status?.backup_codes_remaining ?? 0 })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('totpManageHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SettingsInput
              label={t('currentPassword')}
              type="password"
              value={totpPassword}
              onChange={setTotpPassword}
            />
            <SettingsInput
              label={t('totpCode')}
              type="text"
              value={code}
              onChange={setCode}
            />
          </div>
          {totpError && (
            <div
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
            >
              {totpError}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (!requireTotpPassword() || !requireCode()) return;
                void runTotp(async () => {
                  const result = await userService.regenerateBackupCodes(totpPassword, code);
                  setBackupCodes(result.backup_codes);
                  setPhase('step3');
                  if (result.status) await onStatusChange(result.status);
                  showMessage('success', t('backupCodesRegenerated'));
                });
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('backupCodesRegenerate')}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (!requireTotpPassword() || !requireCode()) return;
                void runTotp(async () => {
                  const next = await userService.disableTotp(totpPassword, code);
                  setBackupCodes(null);
                  setTotpSetup(null);
                  setPhase('idle');
                  if (next) await onStatusChange(next);
                  showMessage('success', t('totpDisabled'));
                });
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {t('totpDisable')}
            </button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
};
