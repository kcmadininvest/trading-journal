import type { TFunction } from 'i18next';

export const CREDENTIALS_DECRYPT_ERROR_CODE = 'credentials_decrypt_failed';
export const TOPSTEP_API_PAUSED_CODE = 'topstep_api_paused';

export type IntegrationErrorPayload = {
  message: string;
  errorCode?: string | null;
};

export function translateIntegrationError(
  t: TFunction<'accounts'>,
  { message, errorCode }: IntegrationErrorPayload,
): string {
  if (errorCode === CREDENTIALS_DECRYPT_ERROR_CODE) {
    return t('sync.errors.credentialsDecryptFailed');
  }
  if (errorCode === TOPSTEP_API_PAUSED_CODE) {
    return t('sync.errors.apiPaused');
  }
  return message;
}
