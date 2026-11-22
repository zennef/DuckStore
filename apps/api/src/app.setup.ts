import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaConflictFilter } from './prisma/prisma-conflict.filter';

/**
 * App-wide setup shared by main.ts and the e2e tests, so tests exercise the same
 * route prefix, validation rules and error mapping as the running API.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // whitelist + forbidNonWhitelisted: unknown fields (such as color on a PATCH) are a 400.
  // transform: bodies become DTO instances, so validated types reach the handlers.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  // Write conflicts and deadlocks (Prisma P2034) become a 409 instead of a 500.
  app.useGlobalFilters(new PrismaConflictFilter(app.getHttpAdapter()));
  return app;
}
