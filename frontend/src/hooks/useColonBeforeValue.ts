import { useMemo } from 'react';
import { colonBeforeValueForUi } from '../utils/frenchTypography';
import { useTranslation } from './useTranslation';

/** Suffixe « : » ou « \u00a0: » selon la langue (FR via i18n + préférences). */
export function useColonBeforeValue(): string {
  const { i18n, language } = useTranslation();
  return useMemo(
    () => colonBeforeValueForUi(i18n.resolvedLanguage, i18n.language, language),
    [i18n.resolvedLanguage, i18n.language, language],
  );
}
