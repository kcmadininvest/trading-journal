import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { authService, AuthRequestError, isAuthThrottledError } from '../services/auth';

interface Props {
  token: string;
  mode: 'confirm' | 'cancel';
}

const Recover2faPage: React.FC<Props> = ({ token: tokenProp, mode }) => {
  const { t } = useI18nTranslation();
  const path =
    mode === 'confirm'
      ? window.location.pathname.match(/^\/recover-2fa\/([^/]+)\/?$/)?.[1]
      : window.location.pathname.match(/^\/cancel-2fa-recovery\/([^/]+)\/?$/)?.[1];
  const token = tokenProp || path || '';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError(t('auth:resetLinkInvalid'));
      return;
    }
    setIsLoading(true);
    try {
      const message =
        mode === 'confirm'
          ? await authService.confirmTwoFactorRecovery(token)
          : await authService.cancelTwoFactorRecovery(token);
      setDone(true);
      setSuccessMessage(
        message ||
          (mode === 'confirm' ? t('auth:recover2faConfirmSubmit') : t('auth:recover2faCancelDone')),
      );
      setTimeout(() => {
        window.location.href = '/';
      }, 2500);
    } catch (err: any) {
      if (isAuthThrottledError(err)) {
        const seconds =
          err instanceof AuthRequestError && typeof err.wait === 'number' && err.wait > 0
            ? err.wait
            : 60;
        setError(t('auth:loginThrottled', { seconds }));
      } else {
        setError(err.message || t('auth:errorOccurred'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'confirm' ? t('auth:recover2faConfirmTitle') : t('auth:recover2faCancelTitle')}
          </h1>
          {mode === 'confirm' && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {t('auth:recover2faConfirmHint')}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {done ? (
          <p className="text-center text-gray-700 dark:text-gray-300">{successMessage}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl disabled:opacity-50"
            >
              {isLoading
                ? t('auth:loading')
                : mode === 'confirm'
                  ? t('auth:recover2faConfirmSubmit')
                  : t('auth:recover2faCancelDone')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Recover2faPage;
