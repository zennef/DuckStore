import { execSync } from 'node:child_process';
import { API_ROOT, testDatabaseUrl } from './test-database';

/** Creates the test database if needed and applies all migrations, once per e2e run. */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'inherit',
  });
}
