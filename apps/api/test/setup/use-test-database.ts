import { testDatabaseUrl } from './test-database';

// Runs before each e2e file loads, so PrismaService connects to the test database.
// ConfigModule does not override variables that are already set.
process.env.DATABASE_URL = testDatabaseUrl();
