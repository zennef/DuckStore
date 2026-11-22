import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Color, Prisma, Size } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';

/** The full app with the same setup as main.ts, plus helpers for seeding and resetting. */
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = configureApp(moduleRef.createNestApplication());
  await app.init();
  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    api: () => request(app.getHttpServer()),
    /** TRUNCATE also resets AUTO_INCREMENT, so ids are predictable per test. */
    reset: () => prisma.$executeRawUnsafe('TRUNCATE TABLE ducks'),
    seed: (duck: Partial<Prisma.DuckCreateInput> = {}) =>
      prisma.duck.create({
        data: { color: Color.Red, size: Size.Large, price: 20, quantity: 10, ...duck },
      }),
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
