/**
 * Parcours mot de passe oublié (compte source csylvanie).
 * Le token est lu en base (l'email réel n'est pas ouvert par Playwright).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.E2E_PASSWORD_RESET_EMAIL ?? 'csylvanie@gmail.com';
const NEW_PASSWORD = process.env.E2E_PASSWORD_RESET_NEW ?? 'PlaywrightResetOk1!';
const repoRoot = path.resolve(__dirname, '../../..');
const backendDir = path.join(repoRoot, 'backend');

function latestResetToken(email: string): string {
  const script = [
    'import django',
    'django.setup()',
    'from accounts.models import PasswordResetToken, User',
    `u = User.objects.get(email__iexact=${JSON.stringify(email)})`,
    't = PasswordResetToken.objects.filter(user=u, is_used=False).order_by("-created_at").first()',
    'assert t is not None, "aucun token reset"',
    'print(t.token)',
  ].join('; ');
  const out = execFileSync(
    'bash',
    ['-lc', `source venv/bin/activate && python -c ${JSON.stringify(script)}`],
    {
      cwd: backendDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        DJANGO_SETTINGS_MODULE: 'trading_journal_api.settings_e2e',
      },
    },
  ).trim();
  return out.split('\n').filter(Boolean).pop()!;
}

test('mot de passe oublié : demande, reset via lien, reconnexion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();

  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();

  await page.locator('#forgotEmail').fill(EMAIL);
  await page.getByRole('button', { name: 'Envoyer le lien' }).click();

  await expect(
    page.getByText(/Si un compte existe pour cette adresse/i),
  ).toBeVisible({ timeout: 15_000 });

  const token = latestResetToken(EMAIL);
  expect(token).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );

  await page.goto(`/reset-password/${token}/`);
  await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();

  await page.locator('#newPassword').fill(NEW_PASSWORD);
  await page.locator('#confirmNewPassword').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe' }).click();

  await expect(page.getByText(/réinitialisé avec succès|Password reset successfully/i)).toBeVisible({
    timeout: 15_000,
  });

  // Redirection vers / puis login avec le nouveau MDP
  await page.waitForURL((url) => url.pathname === '/' || url.hash.includes('dashboard'), {
    timeout: 10_000,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Se connecter' }).first().click();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mot de passe').fill(NEW_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/#dashboard/, { timeout: 20_000 });
});
