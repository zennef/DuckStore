import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API_ROOT = join(__dirname, '..', '..');

/**
 * The database e2e tests run against. TEST_DATABASE_URL wins if set; otherwise it is
 * DATABASE_URL (from the environment or apps/api/.env) with `_test` appended to the
 * database name, so tests never touch the dev data.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envFile = join(API_ROOT, '.env');
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('Set DATABASE_URL or TEST_DATABASE_URL to run e2e tests');

  const url = new URL(base);
  if (!url.pathname.endsWith('_test')) url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export { API_ROOT };
