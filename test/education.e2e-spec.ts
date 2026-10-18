import * as request from 'supertest';
import type { Server } from 'http';
import { body, createTestApp, resetDatabase, type TestApp } from './utils/app';

/**
 * Справочники по HTTP на настоящей базе: юнит-тесты мокают Prisma и не видят,
 * что фильтры по связям и поиск без учёта регистра действительно работают в Postgres.
 */
describe('Справочники (e2e)', () => {
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
      data: {
        telegramId: '3001',
        telegramUsername: 'reader',
        name: 'Читатель',
      },
    });
    userId = user.id;
    token = ctx.tokenFor(user.id, user.telegramId);
  });

  const get = (path: string) =>
    request(server).get(`/api${path}`).set('Authorization', `Bearer ${token}`);

  it('предметы группы: только активное расписание этой группы, с её преподавателями', async () => {
    const [group, otherGroup] = await Promise.all([
      ctx.db.group.create({ data: { number: '4212', foreignId: 'g-1' } }),
      ctx.db.group.create({ data: { number: '4213', foreignId: 'g-2' } }),
    ]);
    const [physics, algebra, archived] = await Promise.all([
      ctx.db.subject.create({ data: { name: 'Физика' } }),
      ctx.db.subject.create({ data: { name: 'Алгебра' } }),
      ctx.db.subject.create({ data: { name: 'Архив', isActive: false } }),
    ]);
    const [ivanov, petrov] = await Promise.all([
      ctx.db.teacher.create({
        data: { fullName: 'Иванов И.И.', foreignId: 't-1' },
      }),
      ctx.db.teacher.create({
        data: { fullName: 'Петров П.П.', foreignId: 't-2' },
      }),
    ]);
    await ctx.db.groupSubject.createMany({
      data: [
        { groupId: group.id, subjectId: physics.id },
        { groupId: group.id, subjectId: algebra.id },
        { groupId: group.id, subjectId: archived.id },
        { groupId: otherGroup.id, subjectId: physics.id },
      ],
    });
    await ctx.db.groupSubjectTeacher.createMany({
      data: [
        { groupId: group.id, subjectId: physics.id, teacherId: petrov.id },
        // выключенная связь не попадает в ответ
        {
          groupId: group.id,
          subjectId: physics.id,
          teacherId: ivanov.id,
          isActive: false,
        },
        // преподаватель другой группы по тому же предмету — не наш
        { groupId: otherGroup.id, subjectId: physics.id, teacherId: ivanov.id },
      ],
    });

    const response = await get(`/education/groups/${group.id}/subjects`).expect(
      200,
    );

    expect(body(response)).toEqual([
      { id: algebra.id, name: 'Алгебра', teachers: [] },
      {
        id: physics.id,
        name: 'Физика',
        teachers: [{ id: petrov.id, fullName: 'Петров П.П.' }],
      },
    ]);
  });

  it('предметы группы: без расписания — пустой список, нет группы — 404', async () => {
    const group = await ctx.db.group.create({
      data: { number: '4214', foreignId: 'g-3' },
    });

    expect(
      body(await get(`/education/groups/${group.id}/subjects`).expect(200)),
    ).toEqual([]);
    await get(
      '/education/groups/00000000-0000-4000-8000-000000000000/subjects',
    ).expect(404);
  });

  it('поиск предметов: без учёта регистра, сначала начинающиеся с запроса, только активные и лёгкие', async () => {
    await ctx.db.subject.createMany({
      data: [
        { name: 'Высшая математика' },
        { name: 'Математика' },
        { name: 'Математика (архив)', isActive: false },
        { name: 'Физика' },
      ],
    });

    const items = body<Record<string, unknown>[]>(
      await get(
        `/education/subjects?search=${encodeURIComponent(' МАТЕМ ')}&limit=20`,
      ).expect(200),
    );

    expect(items.map((s) => s.name)).toEqual([
      'Математика',
      'Высшая математика',
    ]);
    expect(Object.keys(items[0]).sort()).toEqual(['id', 'isActive', 'name']);
  });

  it('заявку нельзя создать на пару, которую преподаватель не ведёт', async () => {
    const subject = await ctx.db.subject.create({ data: { name: 'Химия' } });
    const teacher = await ctx.db.teacher.create({
      data: { fullName: 'Сидоров С.С.', foreignId: 't-3' },
    });

    await request(server)
      .post('/api/marketplace/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ studentId: userId, subjectId: subject.id, teacherId: teacher.id })
      .expect(400);
  });
});
