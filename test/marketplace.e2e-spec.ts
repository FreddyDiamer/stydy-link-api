import * as request from 'supertest';
import type { Server } from 'http';
import { body, createTestApp, resetDatabase, type TestApp } from './utils/app';

/**
 * Сквозной проход петли по HTTP на настоящей базе: заявка → отклик →
 * выбор репетитора → сделка → двустороннее подтверждение → отзывы.
 * Здесь проверяется то, чего не видят юнит-тесты: конвейер запросов,
 * реальные транзакции и ограничения схемы.
 */
describe('Маркетплейс (e2e)', () => {
  let ctx: TestApp;
  let server: Server;

  let studentId: string;
  let tutorId: string;
  let subjectId: string;
  let teacherId: string;
  let studentToken: string;
  let tutorToken: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    server = ctx.app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.db);

    const student = await ctx.db.user.create({
      data: {
        telegramId: '1001',
        telegramUsername: 'student',
        name: 'Максим Котов',
      },
    });
    const tutor = await ctx.db.user.create({
      data: {
        telegramId: '1002',
        telegramUsername: 'tutor',
        name: 'Анна Петрова',
      },
    });
    const subject = await ctx.db.subject.create({
      data: { name: 'Мат. анализ' },
    });
    const teacher = await ctx.db.teacher.create({
      data: { fullName: 'Иванов И.И.', foreignId: 'teacher-ext-1' },
    });

    studentId = student.id;
    tutorId = tutor.id;
    subjectId = subject.id;
    teacherId = teacher.id;
    studentToken = ctx.tokenFor(student.id, student.telegramId);
    tutorToken = ctx.tokenFor(tutor.id, tutor.telegramId);
  });

  const createRequest = async () => {
    const response = await request(server)
      .post('/api/marketplace/requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        studentId,
        subjectId,
        teacherId,
        description: 'Нужна помощь с интегралами',
        budget: 200000,
      })
      .expect(201);
    return body<{ id: string; status: string }>(response);
  };

  const respond = async (requestId: string) => {
    const response = await request(server)
      .post('/api/marketplace/request-responses')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ tutorId, requestId, message: 'Разберём по шагам', price: 140000 })
      .expect(201);
    return body<{ id: string }>(response);
  };

  it('проводит петлю от заявки до двух отзывов', async () => {
    const created = await createRequest();
    expect(created.status).toBe('OPEN');

    const response = await respond(created.id);

    // выбор репетитора закрывает заявку и создаёт сделку
    await request(server)
      .patch(`/api/marketplace/request-responses/${response.id}/accept`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const matched = await ctx.db.request.findUnique({
      where: { id: created.id },
    });
    expect(matched?.status).toBe('MATCHED');

    const deal = await ctx.db.deal.findFirst({
      where: { requestResponseId: response.id },
    });
    expect(deal).not.toBeNull();
    expect(deal?.price).toBe(140000);

    // одна сторона подтвердила — сделка ещё не закрыта
    await request(server)
      .patch(`/api/marketplace/deals/${deal!.id}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    const halfway = await ctx.db.deal.findUnique({ where: { id: deal!.id } });
    expect(halfway?.status).not.toBe('COMPLETED');
    expect(halfway?.tutorConfirmedAt).not.toBeNull();

    // подтвердила вторая — закрылась
    await request(server)
      .patch(`/api/marketplace/deals/${deal!.id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const completed = await ctx.db.deal.findUnique({ where: { id: deal!.id } });
    expect(completed?.status).toBe('COMPLETED');

    // по отзыву с каждой стороны
    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ dealId: deal!.id, rating: 5, comment: 'Всё разложил по полкам' })
      .expect(201);

    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ dealId: deal!.id, rating: 5 })
      .expect(201);

    const reviews = await ctx.db.review.findMany({
      where: { dealId: deal!.id },
    });
    expect(reviews).toHaveLength(2);
    // роли выведены сервером, а не присланы клиентом
    expect(reviews.find((r) => r.authorId === studentId)?.targetRole).toBe(
      'TUTOR',
    );
    expect(reviews.find((r) => r.authorId === tutorId)?.targetRole).toBe(
      'STUDENT',
    );
  });

  const createService = async () => {
    const response = await request(server)
      .post('/api/marketplace/services')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        subjectId,
        teacherId,
        price: 150000,
        lessonsCount: 1,
        lessonDurationMinutes: 60,
        description: 'Интегралы и ряды',
      })
      .expect(201);
    return body<{ id: string }>(response);
  };

  it('проводит петлю от записи на услугу до сделки и отзывов', async () => {
    const service = await createService();

    // запись в одно касание: без своей цены
    const bookingResponse = await request(server)
      .post('/api/marketplace/service-responses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ studentId, serviceId: service.id })
      .expect(201);
    const booking = body<{ id: string }>(bookingResponse);

    // принять запись может только владелец услуги — и это 403, а не 500
    await request(server)
      .patch(`/api/marketplace/service-responses/${booking.id}/accept`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    await request(server)
      .patch(`/api/marketplace/service-responses/${booking.id}/accept`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    // принятие и есть сделка; цена — из услуги, раз студент свою не предлагал
    const deal = await ctx.db.deal.findFirst({
      where: { serviceResponseId: booking.id },
    });
    expect(deal).not.toBeNull();
    expect(deal?.price).toBe(150000);
    expect(deal?.studentId).toBe(studentId);
    expect(deal?.tutorId).toBe(tutorId);

    // повторное принятие не плодит сделок
    await request(server)
      .patch(`/api/marketplace/service-responses/${booking.id}/accept`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(400);
    expect(
      await ctx.db.deal.count({ where: { serviceResponseId: booking.id } }),
    ).toBe(1);

    // обе стороны видят сделку в своём списке
    for (const token of [studentToken, tutorToken]) {
      const list = await request(server)
        .get('/api/marketplace/deals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const { items } = body<{ items: { id: string }[] }>(list);
      expect(items.map((d) => d.id)).toEqual([deal!.id]);
    }

    // двустороннее подтверждение и по отзыву с каждой стороны
    await request(server)
      .patch(`/api/marketplace/deals/${deal!.id}/complete`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    await request(server)
      .patch(`/api/marketplace/deals/${deal!.id}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    const completed = await ctx.db.deal.findUnique({ where: { id: deal!.id } });
    expect(completed?.status).toBe('COMPLETED');

    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ dealId: deal!.id, rating: 5 })
      .expect(201);
    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ dealId: deal!.id, rating: 4 })
      .expect(201);
    expect(await ctx.db.review.count({ where: { dealId: deal!.id } })).toBe(2);
  });

  it('чужую услугу нельзя приостановить или изменить — 403, а не 500', async () => {
    const service = await createService();

    await request(server)
      .patch(`/api/marketplace/services/${service.id}/suspend`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(403);

    await request(server)
      .patch(`/api/marketplace/services/${service.id}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ description: 'взлом' })
      .expect(403);

    const untouched = await ctx.db.service.findUnique({
      where: { id: service.id },
    });
    expect(untouched?.status).toBe('ACTIVE');
    expect(untouched?.description).toBe('Интегралы и ряды');
  });

  it('второй отзыв от того же автора отбивается ограничением схемы', async () => {
    const created = await createRequest();
    const response = await respond(created.id);
    await request(server)
      .patch(`/api/marketplace/request-responses/${response.id}/accept`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const deal = await ctx.db.deal.findFirst({
      where: { requestResponseId: response.id },
    });
    await ctx.db.deal.update({
      where: { id: deal!.id },
      data: { status: 'COMPLETED' },
    });

    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ dealId: deal!.id, rating: 5 })
      .expect(201);

    await request(server)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ dealId: deal!.id, rating: 4 })
      .expect(400);
  });

  it('отклики видят только их участники', async () => {
    const outsider = await ctx.db.user.create({
      data: { telegramId: '1003', telegramUsername: 'outsider', name: 'Чужой' },
    });
    const outsiderToken = ctx.tokenFor(outsider.id, outsider.telegramId);

    const req = await createRequest();
    const requestResponse = await respond(req.id);
    const service = await createService();
    const booking = body<{ id: string }>(
      await request(server)
        .post('/api/marketplace/service-responses')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId, serviceId: service.id })
        .expect(201),
    );

    type Page = { items: { id: string }[]; total: number };
    const list = async (path: string, token: string) =>
      body<Page>(
        await request(server)
          .get(path)
          .set('Authorization', `Bearer ${token}`)
          .expect(200),
      );

    // постороннему чужие отклики не отдаются ни списком, ни по id
    expect(
      (await list('/api/marketplace/service-responses', outsiderToken)).total,
    ).toBe(0);
    expect(
      (
        await list(
          `/api/marketplace/request-responses?requestId=${req.id}`,
          outsiderToken,
        )
      ).total,
    ).toBe(0);
    await request(server)
      .get(`/api/marketplace/service-responses/${booking.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    await request(server)
      .get(`/api/marketplace/service-responses/${booking.id}/stats`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    await request(server)
      .get(`/api/marketplace/request-responses/${requestResponse.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    // владелец объявления видит отклики на него, автор — свои
    const toService = await list(
      `/api/marketplace/service-responses?role=tutor&serviceId=${service.id}&limit=100`,
      tutorToken,
    );
    expect(toService.items.map((i) => i.id)).toEqual([booking.id]);
    const toRequest = await list(
      `/api/marketplace/request-responses?role=student&requestId=${req.id}`,
      studentToken,
    );
    expect(toRequest.items.map((i) => i.id)).toEqual([requestResponse.id]);
    expect(
      (
        await list(
          '/api/marketplace/service-responses?role=student',
          studentToken,
        )
      ).items.map((i) => i.id),
    ).toEqual([booking.id]);
    expect(
      (
        await list('/api/marketplace/request-responses?role=tutor', tutorToken)
      ).items.map((i) => i.id),
    ).toEqual([requestResponse.id]);

    // неизвестная роль — 400, а не молча пустой список
    await request(server)
      .get('/api/marketplace/service-responses?role=admin')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(400);
  });

  it('закрытая заявка выпадает из ленты, но остаётся у автора', async () => {
    const created = await createRequest();

    await request(server)
      .patch(`/api/marketplace/requests/${created.id}/close`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const feed = await request(server)
      .get('/api/marketplace/requests')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);
    expect(body<unknown[]>(feed)).toHaveLength(0);

    // контракт разный: лента отдаёт массив, «мои» — объект { items, total }.
    // фронт это нормализует, тест фиксирует фактическую форму
    const mine = await request(server)
      .get('/api/marketplace/requests/my')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const { items } = body<{ items: { status: string }[] }>(mine);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('CLOSED');
  });
});
