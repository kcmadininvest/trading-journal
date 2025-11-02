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
                <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {t('auth:activationError')}
              </h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">{error}</p>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Aller à la page de connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivateAccountPage;

