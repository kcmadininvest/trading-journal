import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccountSecurityStatus,
  userService,
} from '../../services/userService';
import { isWebAuthnSupported } from '../../utils/webauthn';
import { SettingsInput } from './SettingsInput';
import { SettingsSection } from './SettingsSection';
import { TotpSecurityPanel } from './TotpSecurityPanel';

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
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const webAuthnSupported = isWebAuthnSupported();

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language);

  const load = useCallback(async () => {
    try {
      setStatus(await userService.getSecurityStatus());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('securityLoadError');
      showMessage('error', message);
    }
  }, [showMessage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = useCallback(
    async (next?: AccountSecurityStatus) => {
      if (next) {
        setStatus(next);
        return;
      }
      await load();
    },
    [load],
  );

  const runPasskey = async (fn: () => Promise<void>) => {
    setLoading(true);
    setPasskeyError('');
    try {
      await fn();
      setPassword('');
      await load();
    } catch (e: unknown) {
      const keyOrMsg = mapPasskeyError(e, t('securityActionError'));
      const text = keyOrMsg.startsWith('passkey') ? t(keyOrMsg) : keyOrMsg;
      setPasskeyError(text);
      showMessage('error', text);
    } finally {
      setLoading(false);
    }
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
                    void runPasskey(async () => {
                      await userService.deletePasskey(password, pk.id);
                      showMessage('success', t('passkeyDeleted'));
                    });
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
              void runPasskey(async () => {
                await userService.registerPasskey(password, passkeyLabel.trim() || undefined);
                setPasskeyLabel('');
                setPasskeyError('');
                showMessage('success', t('passkeyAdded'));
              });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {t('passkeyAdd')}
          </button>
        </div>
      </SettingsSection>

      <TotpSecurityPanel
        status={status}
        loading={loading}
        setLoading={setLoading}
        showMessage={showMessage}
        onStatusChange={applyStatus}
      />
    </>
  );
};
