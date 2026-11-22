import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide setup shared by main.ts and the e2e tests, so tests exercise the same
 * route prefix and validation rules as the running API.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // whitelist + forbidNonWhitelisted: unknown fields (such as color on a PATCH) are a 400.
  // transform: bodies become DTO instances, so validated types reach the handlers.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  return app;
}
