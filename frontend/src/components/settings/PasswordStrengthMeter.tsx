import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const { t } = useTranslation();

  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    
    // Longueur
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Complexité
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Déterminer le niveau
    if (score <= 2) {
      return {
        score: 1,
        label: t('settings:passwordWeak', { defaultValue: 'Faible' }),
        color: 'bg-red-500',
        textColor: 'text-red-600 dark:text-red-400',
      };
    } else if (score <= 4) {
      return {
        score: 2,
        label: t('settings:passwordMedium', { defaultValue: 'Moyen' }),
        color: 'bg-amber-500',
        textColor: 'text-amber-600 dark:text-amber-400',
      };
    } else if (score <= 6) {
      return {
        score: 3,
        label: t('settings:passwordGood', { defaultValue: 'Bon' }),
        color: 'bg-blue-500',
        textColor: 'text-blue-600 dark:text-blue-400',
      };
    } else {
      return {
        score: 4,
        label: t('settings:passwordStrong', { defaultValue: 'Fort' }),
        color: 'bg-emerald-500',
        textColor: 'text-emerald-600 dark:text-emerald-400',
      };
    }
  }, [password, t]);

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('settings:passwordStrength', { defaultValue: 'Force du mot de passe' })}
        </span>
        <span className={`text-xs font-semibold ${strength.textColor}`}>
          {strength.label}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              level <= strength.score ? strength.color : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
