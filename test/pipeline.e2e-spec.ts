import * as request from 'supertest';
import type { Server } from 'http';
import { body, createTestApp, resetDatabase, type TestApp } from './utils/app';

/**
 * Конвейер запросов: глобальный guard, ValidationPipe с whitelist,
 * конверт ответа и маппинг ошибок. Юнит-тесты этого не видят, а фронт
 * зависит от каждой из этих деталей.
 */
describe('Конвейер запросов (e2e)', () => {
  let ctx: TestApp;
  let server: Server;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);
    const user = await ctx.db.user.create({
      data: { telegramId: '2001', telegramUsername: 'pipeline', name: 'Тест' },
    });
    userId = user.id;
    token = ctx.tokenFor(user.id, user.telegramId);
  });

  describe('доступ', () => {
    it('закрытый эндпоинт без токена отдаёт 401', async () => {
      await request(server).get('/api/marketplace/requests').expect(401);
    });

    it('с токеном пускает', async () => {
      await request(server)
        .get('/api/marketplace/requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('токен удалённого пользователя больше не работает', async () => {
      await ctx.db.user.delete({ where: { id: userId } });

      await request(server)
        .get('/api/marketplace/requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('битый токен отдаёт 401, а не 500', async () => {
      await request(server)
        .get('/api/marketplace/requests')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
    });
  });

  describe('конверт ответа', () => {
    it('успех приходит обёрнутым в data — на этом держится apiClient', async () => {
      const response = await request(server)
        .get('/api/marketplace/requests')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(body<unknown>(response))).toBe(true);
    });
  });

  describe('валидация', () => {
    it('отбивает лишние поля: forbidNonWhitelisted включён', async () => {
      // фронт больше не шлёт authorId — сервер выводит автора сам,
      // и лишнее поле теперь ломает запрос
      await request(server)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({
          dealId: '00000000-0000-0000-0000-000000000000',
          rating: 5,
          authorId: userId,
        })
        .expect(400);
    });

    it('пагинация и фильтр приходят одним query — page/limit не отбиваются', async () => {
      // раньше два @Query() на методе валили любой ?page= как «лишнее поле»
      const response = await request(server)
        .get('/api/education/teacher-subjects?page=1&limit=100')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(body<{ items: unknown[] }>(response).items).toEqual([]);
    });

    it('проверяет диапазон оценки', async () => {
      await request(server)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ dealId: '00000000-0000-0000-0000-000000000000', rating: 9 })
        .expect(400);
    });

    it('не-uuid в пути отбивается до сервиса', async () => {
      await request(server)
        .get('/api/marketplace/requests/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('ошибки', () => {
    it('несуществующая заявка — 404 с телом, а не пустой ответ', async () => {
      const response = await request(server)
        .get('/api/marketplace/requests/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty('message');
    });

    it('чужую заявку закрыть нельзя', async () => {
      const other = await ctx.db.user.create({
        data: { telegramId: '2002', telegramUsername: 'other', name: 'Другой' },
      });
      const subject = await ctx.db.subject.create({ data: { name: 'Физика' } });
      const teacher = await ctx.db.teacher.create({
        data: { fullName: 'Сидорова М.А.', foreignId: 'teacher-ext-2' },
      });
      const foreign = await ctx.db.request.create({
        data: {
          studentId: other.id,
          subjectId: subject.id,
          teacherId: teacher.id,
        },
      });

      await request(server)
        .patch(`/api/marketplace/requests/${foreign.id}/close`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
