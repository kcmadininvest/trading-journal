import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import integrationsService, { IntegrationStatus } from '../../services/integrationsService';
import { useTopStepApiPaused } from '../../hooks/useTopStepApiPaused';
import { SettingsInput } from './SettingsInput';
import { INTEGRATION_HELP_URLS } from './integrationUiConfig';
import { translateIntegrationError } from '../../utils/integrationErrors';

interface IntegrationCardProps {
  integration: IntegrationStatus;
  onUpdated: (updated: IntegrationStatus) => void;
  onDeleted: (provider: string) => void;
  onMessage: (type: 'success' | 'error', text: string) => void;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  integration,
  onUpdated,
  onDeleted,
  onMessage,
}) => {
  const { t } = useTranslation('settings');
  const { t: tAccounts } = useTranslation('accounts');
  const provider = integration.provider;
  const providerKey = `integrations.providers.${provider}`;

  const [username, setUsername] = useState(integration.external_username || '');
  const [apiKey, setApiKey] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { paused, saving: pauseSaving, setPaused } = useTopStepApiPaused();

  useEffect(() => {
    setUsername(integration.external_username || '');
    setApiKey('');
    setIsEditingApiKey(false);
  }, [integration]);

  const displayName = t(`${providerKey}.name`, { defaultValue: integration.display_name });
  const description = t(`${providerKey}.description`, { defaultValue: '' });
  const helpUrl = INTEGRATION_HELP_URLS[provider];

  const statusLabel = !integration.configured
    ? t('integrations.status.notConfigured')
    : integration.is_connected
      ? t('integrations.status.connected')
      : t('integrations.status.configured');

  const statusClass = !integration.configured
    ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    : integration.is_connected
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: { external_username?: string; api_key?: string } = {
        external_username: username,
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }
      const updated = await integrationsService.saveIntegration(provider, payload);
      onUpdated(updated);
      setApiKey('');
      setIsEditingApiKey(false);
      onMessage('success', t('integrations.saved'));
    } catch (err: unknown) {
      const apiErr = err as Error & { errorCode?: string };
      onMessage(
        'error',
        translateIntegrationError(tAccounts, {
          message: apiErr instanceof Error ? apiErr.message : t('integrations.saveError'),
          errorCode: apiErr.errorCode,
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const payload: { external_username?: string; api_key?: string } = {};
      if (username.trim()) payload.external_username = username.trim();
      if (apiKey.trim()) payload.api_key = apiKey.trim();

      const result = await integrationsService.testConnection(
        provider,
        Object.keys(payload).length ? payload : undefined
      );
      if (result.integration) {
        onUpdated(result.integration);
      }
      if (result.success) {
        onMessage('success', result.message || t('integrations.testSuccess'));
      } else {
        onMessage(
          'error',
          translateIntegrationError(tAccounts, {
            message: result.message || t('integrations.testFailed'),
            errorCode: result.error_code,
          }),
        );
      }
    } catch (err: unknown) {
      const apiErr = err as Error & { errorCode?: string };
      onMessage(
        'error',
        translateIntegrationError(tAccounts, {
          message: apiErr instanceof Error ? apiErr.message : t('integrations.testFailed'),
          errorCode: apiErr.errorCode,
        }),
      );
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('integrations.confirmDelete', { name: displayName }))) {
      return;
    }
    setDeleting(true);
    try {
      await integrationsService.deleteIntegration(provider);
      onDeleted(provider);
      setUsername('');
      setApiKey('');
      onMessage('success', t('integrations.deleted'));
    } catch (err: unknown) {
      onMessage('error', err instanceof Error ? err.message : t('integrations.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  const apiKeyHint = integration.secrets_hint?.api_key;
  const apiKeyLabel = t(`${providerKey}.apiKey`, { defaultValue: t('integrations.apiKey') });
  const showMaskedApiKey =
    integration.configured && !apiKey.trim() && !isEditingApiKey;
  const maskedApiKeyDisplay =
    apiKeyHint || t('integrations.apiKeyMaskedPlaceholder');

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">{displayName}</h4>
          {description ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4">
        {integration.public_fields.includes('external_username') && (
          <SettingsInput
            label={t(`${providerKey}.username`, { defaultValue: t('integrations.username') })}
            labelVariant="above"
            type="text"
            value={username}
            onChange={setUsername}
          />
        )}

        {integration.required_secret_fields.includes('api_key') && (
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {apiKeyLabel}
            </label>
            {showMaskedApiKey ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-stretch gap-2">
                  <input
                    type="text"
                    readOnly
                    value={maskedApiKeyDisplay}
                    tabIndex={-1}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm tracking-widest text-gray-600 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-400"
                    aria-label={apiKeyLabel}
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingApiKey(true)}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {t('integrations.changeApiKey')}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('integrations.apiKeyStored')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('integrations.apiKeyPlaceholder')}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/30"
                />
                {integration.configured && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKey('');
                      setIsEditingApiKey(false);
                    }}
                    className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {t('integrations.cancelApiKeyEdit')}
                  </button>
                )}
                {!apiKey.trim() && integration.configured && isEditingApiKey && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('integrations.apiKeyPlaceholderKeep', {
                      hint: apiKeyHint || '****',
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {integration.last_validated_at && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('integrations.lastValidated', {
              date: new Date(integration.last_validated_at).toLocaleString(),
            })}
          </p>
        )}

        {helpUrl && (
          <p className="text-xs">
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {t('integrations.helpLink')}
            </a>
          </p>
        )}

        {provider === 'topstepx' && integration.configured && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
            <div className="flex min-w-0 items-center gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-gray-600 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <div className="min-w-0">
                <span className="block text-sm text-gray-700 dark:text-gray-300">
                  {t('integrations.topstepApiToggleLabel')}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {t('integrations.topstepApiPausedHelp')}
                </span>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!paused}
              aria-label={t('integrations.topstepApiToggleLabel')}
              disabled={pauseSaving}
              onClick={() => {
                void setPaused(!paused).catch(() => {
                  onMessage('error', t('integrations.pauseToggleError'));
                });
              }}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                !paused ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  !paused ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || testing || deleting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? t('integrations.saving') : t('integrations.save')}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={saving || testing || deleting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {testing ? t('integrations.testing') : t('integrations.testConnection')}
          </button>
          {integration.configured && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || testing || deleting}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {deleting ? t('integrations.deleting') : t('integrations.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
