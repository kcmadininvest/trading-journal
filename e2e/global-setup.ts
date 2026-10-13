import { execFileSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const backendDir = path.join(repoRoot, 'backend');

function assertQualifTarget(): void {
  if (!process.env.E2E_TEST_PASSWORD) {
    throw new Error('E2E_TEST_PASSWORD est requis pour lancer les tests de qualification.');
  }
  const raw = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
  const url = new URL(raw);
  const extra = (process.env.E2E_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const allowed = new Set(['127.0.0.1', 'localhost', ...extra]);
  if (!allowed.has(url.hostname)) {
    throw new Error(`Hôte refusé pour Playwright : ${url.hostname}`);
  }
  if (!process.env.E2E_BASE_URL && (url.hostname !== '127.0.0.1' || url.port !== '3100')) {
    throw new Error('Sans E2E_BASE_URL, la cible est http://127.0.0.1:3100.');
  }
}

function django(args: string[]): void {
  execFileSync(
    'bash',
    ['-lc', `source venv/bin/activate && python manage.py ${args.join(' ')}`],
    {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DJANGO_SETTINGS_MODULE: 'trading_journal_api.settings_e2e',
      },
    },
  );
}

export default function globalSetup(): void {
  assertQualifTarget();
  try {
    django(['migrate', '--check']);
  } catch {
    throw new Error(
      'Des migrations manquent sur la base de qualification. Lance manage.py migrate, puis relance les tests.',
    );
  }
  django(['clone_user_dataset']);
}
