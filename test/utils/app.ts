import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';
import { GlobalExceptionFilter } from '../../src/common';

export interface TestApp {
  app: INestApplication;
  db: DatabaseService;
  /** Bearer-токен для пользователя, который уже есть в базе. */
  tokenFor: (userId: string, telegramId: string) => string;
  close: () => Promise<void>;
}

/**
 * Поднимает приложение ровно с тем конвейером, что в main.ts: тот же
 * ValidationPipe, тот же фильтр ошибок, тот же префикс. Иначе e2e проверял бы
 * не то приложение, которое уезжает в прод.
 */
export const createTestApp = async (): Promise<TestApp> => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();

  const db = app.get(DatabaseService);
  const jwt = app.get(JwtService);

  return {
    app,
    db,
    tokenFor: (userId, telegramId) => jwt.sign({ sub: userId, telegramId }),
    close: async () => {
      await app.close();
    },
  };
};

/** Чистая база перед каждым тестом: порядок важен из-за внешних ключей. */
export const resetDatabase = async (db: DatabaseService): Promise<void> => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE reviews, deals, request_responses, service_responses, requests, services, users, teacher_subjects, teachers, subjects, groups RESTART IDENTITY CASCADE',
  );
};

/** Тело успешного ответа: apiClient на фронте разворачивает именно `data`. */
export const body = <T>(response: { body: unknown }): T =>
  (response.body as { data: T }).data;
