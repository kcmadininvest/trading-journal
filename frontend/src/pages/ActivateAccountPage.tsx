import React, { useState, useEffect } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getApiBaseUrl } from '../utils/apiConfig';

interface ActivateAccountPageProps {
  token: string;
}

const ActivateAccountPage: React.FC<ActivateAccountPageProps> = ({ token: tokenProp }) => {
  const { t } = useI18nTranslation();
  // Extraire le token de l'URL si pas fourni en prop
  const pathToken = window.location.pathname.match(/^\/activate-account\/([^/]+)\/?$/)?.[1];
  const token = tokenProp || pathToken || '';
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isAlreadyActivated, setIsAlreadyActivated] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    const activateAccount = async () => {
      if (!token) {
        setError(t('auth:activationLinkInvalid'));
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${getApiBaseUrl()}/api/accounts/auth/activate/${token}/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          // Vérifier si le compte était déjà activé
          if (data.already_activated) {
            setMessage(data.message || t('auth:accountAlreadyActivatedMessage'));
            setIsSuccess(true);
            setIsAlreadyActivated(true);
            
            // Rediriger vers la page de connexion plus rapidement
            setTimeout(() => {
              window.location.href = '/';
            }, 2500);
          } else {
            setMessage(data.message || t('auth:accountActivatedMessage'));
            setIsSuccess(true);
            setIsAlreadyActivated(false);
            
            // Rediriger vers la page de connexion après 3 secondes
            setTimeout(() => {
              window.location.href = '/';
            }, 3000);
          }
        } else {
          // Si le token a déjà été utilisé, c'est que le compte est déjà activé
          // On considère cela comme un succès et on redirige
          if (data.error && (data.error.includes('déjà été utilisé') || data.error.includes('already been used'))) {
            setMessage(t('auth:accountAlreadyActivatedMessage'));
            setIsSuccess(true);
            setIsAlreadyActivated(true);
            
            // Rediriger vers la homepage immédiatement
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          } else if (data.can_resend && data.user_id) {
            // Token expiré, proposer de renvoyer l'email
            setError(data.error || t('auth:activationLinkExpired'));
            setCanResend(true);
            setUserId(data.user_id);
            setIsSuccess(false);
          } else {
            setError(data.error || data.detail || t('auth:activationError'));
            setIsSuccess(false);
          }
        }
      } catch (err: any) {
        setError(err.message || t('auth:activationError'));
        setIsSuccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    activateAccount();
  }, [token, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">{t('auth:activatingAccount')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          {isSuccess ? (
            <>
              <div className="mb-4">
                <svg className={`mx-auto h-16 w-16 ${isAlreadyActivated ? 'text-blue-500' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isAlreadyActivated ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {isAlreadyActivated ? t('auth:accountAlreadyActivated') : t('auth:accountActivated')}
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">{message}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Redirection en cours...
              </p>
            </>
          ) : (
            <>
              <div className="mb-4">
                <svg className="mx-auto h-16 w-16 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {canResend ? t('auth:activationLinkExpired') : t('auth:activationError')}
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
              
              {canResend && !resendSuccess && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {t('auth:activationLinkExpiredMessage')}
                  </p>
                  <button
                    onClick={async () => {
                      if (!userId) return;
                      setIsResending(true);
                      try {
                        const response = await fetch(`${getApiBaseUrl()}/api/accounts/auth/resend-activation/`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ user_id: userId }),
                        });

                        const data = await response.json();

                        if (response.ok) {
                          setResendSuccess(true);
                          setMessage(data.message || t('auth:activationEmailResent'));
                        } else {
                          setError(data.error || t('auth:resendActivationError'));
                        }
                      } catch (err: any) {
                        setError(err.message || t('auth:resendActivationError'));
                      } finally {
                        setIsResending(false);
                      }
                    }}
                    disabled={isResending}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors mb-3"
                  >
                    {isResending ? t('auth:sending') : t('auth:resendActivationEmail')}
                  </button>
                </div>
              )}

              {resendSuccess && (
                <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-green-800 dark:text-green-300 text-sm">{message}</p>
                  <p className="text-green-700 dark:text-green-400 text-xs mt-2">
                    {t('auth:checkYourEmail')}
                  </p>
                </div>
              )}

              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                {t('auth:goToLoginPage')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivateAccountPage;

