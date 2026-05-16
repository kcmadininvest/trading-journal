import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import integrationsService, { IntegrationStatus } from '../../services/integrationsService';
import { IntegrationCard } from './IntegrationCard';

interface IntegrationsSectionProps {
  onMessage: (type: 'success' | 'error', text: string) => void;
}

export const IntegrationsSection: React.FC<IntegrationsSectionProps> = ({ onMessage }) => {
  const { t } = useTranslation('settings');
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await integrationsService.listIntegrations();
        if (!cancelled) {
          setIntegrations(data.integrations);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t('integrations.loadError');
        if (!cancelled) {
          setLoadError(message);
          onMessageRef.current('error', message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleUpdated = (updated: IntegrationStatus) => {
    setIntegrations((prev) =>
      prev.map((item) => (item.provider === updated.provider ? updated : item))
    );
  };

  const handleDeleted = (provider: string) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.provider === provider
          ? {
              ...item,
              configured: false,
              external_username: '',
              secrets_hint: {},
              is_connected: false,
              last_validated_at: null,
            }
          : item
      )
    );
  };

  return (
    <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
        {t('integrations.title')}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {t('integrations.description')}
      </p>

      {loadError && !loading ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>
      ) : integrations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('integrations.empty')}</p>
      ) : (
        <div className="space-y-4">
          {integrations.map((item) => (
            <IntegrationCard
              key={item.provider}
              integration={item}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
              onMessage={onMessage}
            />
          ))}
        </div>
      )}
    </div>
  );
};
