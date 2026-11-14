import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccountSecurityStatus,
  userService,
} from '../../services/userService';
import { isWebAuthnSupported } from '../../utils/webauthn';
import { SettingsInput } from './SettingsInput';
import { SettingsSection } from './SettingsSection';

interface Props {
  showMessage: (type: 'success' | 'error', text: string) => void;
}

function mapPasskeyError(err: unknown, fallback: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
  const msg = `${name} ${raw}`.toLowerCase();
  if (msg.includes('relying party') || msg.includes('rp id') || msg.includes('registrable domain')) {
    return 'passkeyRpIdMismatch';
  }
  if (name === 'NotAllowedError' || msg.includes('notallowed') || msg.includes('timed out') || msg.includes('cancel')) {
    return 'passkeyCancelled';
  }
  if (name === 'InvalidStateError' || msg.includes('already registered')) {
    return 'passkeyAlreadyRegistered';
  }
  return raw || fallback;
}

export const AccountSecuritySection: React.FC<Props> = ({ showMessage }) => {
  const { t, i18n } = useTranslation('settings');
  const [status, setStatus] = useState<AccountSecurityStatus | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [totpError, setTotpError] = useState('');
  const webAuthnSupported = isWebAuthnSupported();

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qr_data_url: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await userService.getSecurityStatus());
    } catch (e: any) {
      showMessage('error', e.message || t('securityLoadError'));
    }
  }, [showMessage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearSecrets = () => {
    setPassword('');
    setCode('');
  };

  const run = async (fn: () => Promise<void>, opts?: { passkey?: boolean; totp?: boolean }) => {
    setLoading(true);
    if (opts?.passkey) setPasskeyError('');
    if (opts?.totp) setTotpError('');
    try {
      await fn();
      clearSecrets();
      await load();
    } catch (e: any) {
      const keyOrMsg = mapPasskeyError(e, t('securityActionError'));
      const text = keyOrMsg.startsWith('passkey') ? t(keyOrMsg) : keyOrMsg;
      if (opts?.passkey) setPasskeyError(text);
      if (opts?.totp) setTotpError(text);
      showMessage('error', text);
    } finally {
      setLoading(false);
    }
  };

  const requirePassword = (): boolean => {
    if (password.trim()) return true;
    const msg = t('totpPasswordRequired');
    setTotpError(msg);
    showMessage('error', msg);
    return false;
  };

  const requirePasswordAndCode = (): boolean => {
    if (!requirePassword()) return false;
    if (code.trim()) return true;
    const msg = t('totpCodeRequired');
    setTotpError(msg);
    showMessage('error', msg);
    return false;
  };

  return (
    <>
      <SettingsSection
        title={t('passkeyTitle')}
        description={t('passkeyDesc')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {status?.passkey_enabled
            ? t('passkeyActive', { total: status.passkeys.length })
            : t('passkeyInactive')}
        </p>
        {!webAuthnSupported && (
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">{t('passkeyUnsupported')}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 mb-2">
          <SettingsInput
            label={t('currentPassword')}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <SettingsInput
            label={t('passkeyLabel')}
            type="text"
            value={passkeyLabel}
            onChange={setPasskeyLabel}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('passkeyPasswordRequired')}</p>
        {passkeyError && (
          <div
            role="alert"
            className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
          >
            {passkeyError}
          </div>
        )}
        {status && status.passkeys.length > 0 && (
          <ul className="mb-3 divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
            {status.passkeys.map((pk) => (
              <li key={pk.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {pk.label || t('passkeyDefaultLabel')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('passkeyCreatedAt', { date: formatDate(pk.created_at) })}
                    {' · '}
                    {pk.last_used_at
                      ? t('passkeyLastUsedAt', { date: formatDate(pk.last_used_at) })
                      : t('passkeyNeverUsed')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  title={!password ? t('passkeyPasswordRequired') : undefined}
                  onClick={() => {
                    if (!password.trim()) {
                      const msg = t('passkeyPasswordRequired');
                      setPasskeyError(msg);
                      showMessage('error', msg);
                      return;
                    }
                    void run(async () => {
                      await userService.deletePasskey(password, pk.id);
                      showMessage('success', t('passkeyDeleted'));
                    }, { passkey: true });
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                >
                  {t('passkeyDelete')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-1">
          <button
            type="button"
            disabled={loading || !webAuthnSupported}
            onClick={() => {
              if (!password.trim()) {
                const msg = t('passkeyPasswordRequired');
                setPasskeyError(msg);
                showMessage('error', msg);
                return;
              }
              void run(async () => {
                await userService.registerPasskey(password, passkeyLabel.trim() || undefined);
                setPasskeyLabel('');
                setPasskeyError('');
                showMessage('success', t('passkeyAdded'));
              }, { passkey: true });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {t('passkeyAdd')}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('totpTitle')}
        description={t('totpDesc')}
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {status?.totp_enabled
            ? t('totpActive', { remaining: status.backup_codes_remaining })
            : t('totpInactive')}
        </p>
        {totpSetup && (
          <div className="mb-4 space-y-2">
            <img src={totpSetup.qr_data_url} alt="QR 2FA" className="w-48 h-48 bg-white p-2 rounded" />
            <p className="text-xs text-gray-600 dark:text-gray-300">{t('totpManualSecret')}</p>
            <code className="block rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 font-mono text-sm font-semibold tracking-wide break-all text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-50">
              {totpSetup.secret}
            </code>
          </div>
        )}
        {backupCodes && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700">
            <p className="text-xs font-medium mb-2 text-amber-950 dark:text-amber-100">{t('backupCodesRevealOnce')}</p>
            <ul className="grid grid-cols-2 gap-1 font-mono text-sm font-semibold text-gray-900 dark:text-gray-50">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <SettingsInput
            label={t('currentPassword')}
            type="password"
            value={password}
            onChange={setPassword}
          />
          <SettingsInput
            label={t('totpCode')}
            type="text"
            value={code}
            onChange={setCode}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('totpCredentialsHint')}</p>
        {totpError && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100"
          >
            {totpError}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {!status?.totp_enabled && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!requirePassword()) return;
                  void run(async () => {
                    const setup = await userService.beginTotp(password);
                    setTotpSetup({ secret: setup.secret, qr_data_url: setup.qr_data_url });
                    showMessage('success', t('totpSetupStarted'));
                  }, { totp: true });
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('totpBegin')}
              </button>
              {totpSetup && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    if (!requirePasswordAndCode()) return;
                    void run(async () => {
                      const result = await userService.confirmTotp(password, code);
                      setBackupCodes(result.backup_codes);
                      setTotpSetup(null);
                      showMessage('success', t('totpEnabled'));
                    }, { totp: true });
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {t('totpConfirm')}
                </button>
              )}
            </>
          )}
          {status?.totp_enabled && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!requirePasswordAndCode()) return;
                  void run(async () => {
                    const result = await userService.regenerateBackupCodes(password, code);
                    setBackupCodes(result.backup_codes);
                    showMessage('success', t('backupCodesRegenerated'));
                  }, { totp: true });
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('backupCodesRegenerate')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  if (!requirePasswordAndCode()) return;
                  void run(async () => {
                    await userService.disableTotp(password, code);
                    setBackupCodes(null);
                    setTotpSetup(null);
                    showMessage('success', t('totpDisabled'));
                  }, { totp: true });
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {t('totpDisable')}
              </button>
            </>
          )}
        </div>
      </SettingsSection>
    </>
  );
};
