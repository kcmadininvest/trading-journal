/**
 * Campagne Playwright — passkeys + TOTP sur stack qualif (Vite:3000 → Daphne:8001).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type Page,
  type CDPSession,
} from '@playwright/test';

const EMAIL = process.env.E2E_SECURITY_EMAIL ?? 'security-e2e@localhost';
const PASSWORD = process.env.E2E_SECURITY_PASSWORD ?? 'SecurityE2E-Pass123!';
const backendDir = path.resolve(__dirname, '../../../backend');
const managePy = path.join(backendDir, 'manage.py');
const venvPython = path.join(backendDir, 'venv/bin/python');

function totpNow(secret: string): string {
  return execFileSync(
    venvPython,
    ['-c', `import pyotp; print(pyotp.TOTP(${JSON.stringify(secret)}).now())`],
    { encoding: 'utf8' },
  ).trim();
}

function clearLoginThrottleCache(): void {
  execFileSync(
    venvPython,
    [
      managePy,
      'shell',
      '-c',
      `
from django.core.cache import cache
client = cache.client.get_client(write=True)
n = 0
for k in client.scan_iter(match=b'*throttle*', count=200):
    client.delete(k); n += 1
for k in client.scan_iter(match=b'*login*', count=200):
    client.delete(k); n += 1
print(n)
`,
    ],
    { encoding: 'utf8', cwd: backendDir },
  );
}

function resetSecurityAccountViaDjango(): void {
  execFileSync(
    venvPython,
    [
      managePy,
      'shell',
      '-c',
      `
from django.contrib.auth import get_user_model
from accounts.account_security import destroy_totp
from accounts.models import WebAuthnCredential
from trades.models import TradingAccount
u = get_user_model().objects.get(email=${JSON.stringify(EMAIL)})
destroy_totp(u)
WebAuthnCredential.objects.filter(user=u).delete()
u.set_password(${JSON.stringify(PASSWORD)})
u.save()
prefs = u.preferences
prefs.tutorials_auto_prompt_dismissed = True
prefs.save(update_fields=['tutorials_auto_prompt_dismissed', 'updated_at'])
TradingAccount.objects.get_or_create(
    user=u,
    name='E2E Security',
    defaults={
        'account_type': 'other',
        'currency': 'USD',
        'initial_capital': 10000,
        'status': 'active',
    },
)
print('ok')
`,
    ],
    { encoding: 'utf8', cwd: backendDir },
  );
}

async function csrfHeaders(api: APIRequestContext): Promise<Record<string, string>> {
  await api.get('/api/accounts/auth/csrf/');
  const state = await api.storageState();
  const csrf = state.cookies.find((c) => c.name === 'csrftoken')?.value;
  const base = test.info().project.use.baseURL || 'http://127.0.0.1:3000';
  return {
    'Content-Type': 'application/json',
    Referer: `${base}/`,
    Origin: String(base),
    ...(csrf ? { 'X-CSRFToken': csrf } : {}),
  };
}

async function postWithThrottleRetry(
  api: APIRequestContext,
  url: string,
  options: { headers?: Record<string, string>; data?: unknown },
  attempts = 4,
): Promise<APIResponse> {
  let last: APIResponse | undefined;
  for (let i = 0; i < attempts; i++) {
    const headers = options.headers ?? (await csrfHeaders(api));
    last = await api.post(url, { headers, data: options.data });
    if (last.status() !== 429) return last;
    clearLoginThrottleCache();
    await new Promise((r) => setTimeout(r, 1100));
  }
  return last!;
}

async function loginPassword(api: APIRequestContext) {
  return postWithThrottleRetry(api, '/api/accounts/auth/login/', {
    data: { email: EMAIL, password: PASSWORD },
  });
}

async function ensureCleanAccount(api: APIRequestContext) {
  clearLoginThrottleCache();
  resetSecurityAccountViaDjango();
  const login = await loginPassword(api);
  expect(login.ok(), `login cleanup failed: ${login.status()} ${await login.text()}`).toBeTruthy();
  const body = await login.json();
  if (body.requires_2fa) {
    throw new Error('Compte encore en 2FA après reset Django.');
  }
}

async function enableVirtualAuthenticator(page: Page): Promise<CDPSession> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return client;
}

test.describe.serial('Sécurité — API', () => {
  test.beforeEach(() => {
    clearLoginThrottleCache();
  });

  test('password login : cookies sans JWT JSON', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    clearLoginThrottleCache();
    resetSecurityAccountViaDjango();
    const resp = await loginPassword(api);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.user.email).toBe(EMAIL);
    expect(body.access).toBeUndefined();
    const names = (await api.storageState()).cookies.map((c) => c.name);
    expect(names).toContain('tj_access');
    await api.dispose();
  });

  test('passkey begin : options + anti-énumération email', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    await ensureCleanAccount(api);
    const anon = await playwrightRequest.newContext({ baseURL });
    const a = await postWithThrottleRetry(anon, '/api/accounts/auth/login/passkey/begin/', {
      data: {},
    });
    expect(a.ok()).toBeTruthy();
    const aBody = await a.json();
    expect(aBody.challenge_id).toBeTruthy();
    expect(aBody.challenge).toBeTruthy();
    const b = await postWithThrottleRetry(anon, '/api/accounts/auth/login/passkey/begin/', {
      data: { email: 'nobody-e2e@example.com' },
    });
    expect(b.ok()).toBeTruthy();
    const bBody = await b.json();
    expect(bBody.challenge_id).toBeTruthy();
    expect(bBody.challenge).toBeTruthy();
    await anon.dispose();
    await api.dispose();
  });

  test('2FA : challenge + cookie après TOTP (coexiste sans clé secrète)', async ({ baseURL }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    await ensureCleanAccount(api);
    const headers = await csrfHeaders(api);

    const begin = await api.post('/api/accounts/security/totp/begin/', {
      headers,
      data: { password: PASSWORD },
    });
    const { secret, qr_data_url } = await begin.json();
    expect(qr_data_url).toContain('data:image/png');

    const confirm = await api.post('/api/accounts/security/totp/confirm/', {
      headers,
      data: { password: PASSWORD, code: totpNow(secret) },
    });
    expect(confirm.ok()).toBeTruthy();
    expect((await confirm.json()).backup_codes).toHaveLength(10);

    const status = await (await api.get('/api/accounts/security/', { headers })).json();
    expect(status.totp_enabled).toBeTruthy();

    clearLoginThrottleCache();
    const anon = await playwrightRequest.newContext({ baseURL });
    const step = await postWithThrottleRetry(anon, '/api/accounts/auth/login/', {
      data: { email: EMAIL, password: PASSWORD },
    });
    const stepBody = await step.json();
    expect(stepBody.requires_2fa).toBeTruthy();
    expect((await anon.storageState()).cookies.map((c) => c.name)).not.toContain('tj_access');

    const verify = await postWithThrottleRetry(anon, '/api/accounts/auth/login/2fa/', {
      data: { challenge: stepBody.challenge, code: totpNow(secret) },
    });
    expect(verify.ok()).toBeTruthy();
    expect((await anon.storageState()).cookies.map((c) => c.name)).toContain('tj_access');
    await anon.dispose();
    await api.dispose();
  });
});

test.describe('Sécurité — UI', () => {
  test.beforeEach(() => {
    clearLoginThrottleCache();
  });

  test('AuthModal : CTA passkey visible', async ({ page }) => {
    await page.goto('/');
    const openLogin = page.getByRole('button', { name: /Se connecter|Log in/i }).first();
    await expect(openLogin).toBeVisible({ timeout: 60_000 });
    await openLogin.click();
    await expect(page.getByRole('button', { name: /passkey/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /Utiliser mon email|Use my email/i })).toHaveCount(0);
  });

  test('login password + Settings : enregistrer une passkey (Virtual Authenticator)', async ({
    page,
    baseURL,
  }) => {
    const api = await playwrightRequest.newContext({ baseURL });
    await ensureCleanAccount(api);
    await api.dispose();
    clearLoginThrottleCache();

    await enableVirtualAuthenticator(page);

    await page.goto('/');
    const openLogin = page.getByRole('button', { name: /Se connecter|Log in/i }).first();
    await expect(openLogin).toBeVisible({ timeout: 60_000 });
    await openLogin.click();
    await page.getByLabel(/Email/i).fill(EMAIL);
    await page.getByLabel(/Mot de passe|Password/i).fill(PASSWORD);
    await page.locator('form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/#(dashboard|accounts)/, { timeout: 45_000 });

    const dismissBlockingModals = async () => {
      const candidates = [
        page.getByRole('button', { name: /Compris|Got it/i }),
        page.getByRole('button', { name: /Plus tard|Later/i }),
      ];
      for (let i = 0; i < 3; i++) {
        let clicked = false;
        for (const btn of candidates) {
          if (!(await btn.isVisible().catch(() => false))) continue;
          await btn.click({ force: true, timeout: 2_000 }).catch(() => undefined);
          clicked = true;
          break;
        }
        if (!clicked) break;
        await page.waitForTimeout(200);
      }
      await page
        .locator('div.fixed.inset-0.z-50')
        .waitFor({ state: 'hidden', timeout: 3_000 })
        .catch(() => undefined);
    };

    await dismissBlockingModals();
    await page.goto('/#settings?tab=security');
    await dismissBlockingModals();
    await expect(page.getByText(/Passkeys/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Double authentification|Two-factor|2FA/i).first()).toBeVisible();

    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole('button', { name: /Ajouter une passkey|Add a passkey|Add passkey/i }).click({
      timeout: 10_000,
    });
    await expect(page.getByText(/Passkey ajoutée|Passkey added|enregistrée/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
