import { Test } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  expectBusinessError,
  firstCallArg,
  type DatabaseMock,
  type ReadArg,
  type WriteArg,
} from '../../../test-support/mocks';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'request-1',
  studentId: STUDENT,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  budget: 150000,
  description: 'Нужна помощь с матанализом',
  deadline: new Date('2026-12-01'),
  status: 'OPEN',
  responses: [],
  ...overrides,
});

const createDto = (overrides: Record<string, unknown> = {}) =>
  ({
    studentId: STUDENT,
    subjectId: 'subject-1',
    teacherId: 'teacher-1',
    description: 'Нужна помощь с матанализом',
    budget: 150000,
    ...overrides,
  }) as never;

describe('RequestsService', () => {
  let service: RequestsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: createNotificationMock() },
      ],
    }).compile();

    service = moduleRef.get(RequestsService);

    db.user.findUnique.mockResolvedValue({ id: STUDENT, name: 'Студент' });
    db.subject.findUnique.mockResolvedValue({
      id: 'subject-1',
      name: 'Математика',
    });
    db.teacher.findUnique.mockResolvedValue({
      id: 'teacher-1',
      fullName: 'Иванов И.И.',
    });
    db.teacherSubject.findFirst.mockResolvedValue({ id: 'ts-1' });
    db.request.create.mockResolvedValue(requestRow());
    db.request.findUnique.mockResolvedValue(requestRow());
    db.request.update.mockResolvedValue(requestRow());
    db.request.count.mockResolvedValue(0);
  });

  describe('создание заявки', () => {
    it('сохраняет заявку с полями автора', async () => {
      await service.create(createDto());

      expect(db.request.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: STUDENT,
            subjectId: 'subject-1',
            budget: 150000,
          }),
        }),
      );
    });

    it('возвращает 404 по несуществующему студенту', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto()), {
        code: 'NOT_FOUND',
        status: 404,
      });
      expect(db.request.create).not.toHaveBeenCalled();
    });

    it('возвращает 404 по несуществующему предмету', async () => {
      db.subject.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto()), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('возвращает 404 по несуществующему преподавателю', async () => {
      db.teacher.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto()), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('требует, чтобы преподаватель вёл предмет (активная связь)', async () => {
      db.teacherSubject.findFirst.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto()), {
        status: 400,
      });
      expect(db.teacherSubject.findFirst).toHaveBeenCalledWith({
        where: {
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
          isActive: true,
        },
      });
      expect(db.request.create).not.toHaveBeenCalled();
    });
  });

  describe('поиск заявок', () => {
    it('фильтрует по диапазону бюджета', async () => {
      db.request.findMany.mockResolvedValue([]);

      await service.findAll({ minBudget: 100000, maxBudget: 200000 } as never);

      const args = db.request.findMany.mock.calls[0][0];
      expect(args.where.budget).toEqual({ gte: 100000, lte: 200000 });
    });

    it('ищет по описанию без учёта регистра', async () => {
      db.request.findMany.mockResolvedValue([]);

      await service.findAll({ search: '  экзамен  ' } as never);

      const args = db.request.findMany.mock.calls[0][0];
      expect(args.where.description).toEqual({
        contains: 'экзамен',
        mode: 'insensitive',
      });
    });

    it('открытые заявки — только с неистёкшим сроком', async () => {
      db.request.findMany.mockResolvedValue([]);

      await service.findOpenRequests();

      const args = db.request.findMany.mock.calls[0][0];
      expect(args.where.deadline.gte).toBeInstanceOf(Date);
      expect(args.where.deadline.gte.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('помечает заявки, на которые текущий репетитор уже откликнулся', async () => {
      db.request.findMany.mockResolvedValue([
        requestRow({ responses: [{ id: 'rr-1', tutor: { id: TUTOR } }] }),
        requestRow({ id: 'request-2', responses: [] }),
      ]);

      const items = await service.findOpenRequests(TUTOR);

      expect(items[0].currentUserResponded).toBe(true);
      expect(items[1].currentUserResponded).toBe(false);
    });

    it('не проставляет флаг отклика анонимному запросу', async () => {
      db.request.findMany.mockResolvedValue([requestRow()]);

      const items = await service.findOpenRequests();

      expect(items[0]).not.toHaveProperty('currentUserResponded');
    });

    it('возвращает 404 по несуществующей заявке', async () => {
      db.request.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.findOne('missing'), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });
  });

  describe('срок заявки', () => {
    const daysFromNow = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    it('прошедший срок при создании — 400 с понятным текстом, заявка не создаётся', async () => {
      await expectBusinessError(
        () => service.create(createDto({ deadline: daysFromNow(-2) })),
        { status: 400 },
      );
      await expect(
        service.create(createDto({ deadline: daysFromNow(-2) })),
      ).rejects.toThrow(
        'Срок уже прошёл — выберите сегодняшнюю или будущую дату',
      );
      expect(db.request.create).not.toHaveBeenCalled();
    });

    it('будущий срок уходит в Prisma как Date', async () => {
      const deadline = daysFromNow(3);

      await service.create(createDto({ deadline }));

      const data = db.request.create.mock.calls[0][0].data;
      expect(data.deadline).toBe(deadline);
    });

    it('при правке прошедший срок не мешает, если его не меняют', async () => {
      const past = daysFromNow(-10);
      db.request.findUnique.mockResolvedValue(requestRow({ deadline: past }));

      await service.update('request-1', {
        description: 'Уточнил задачу',
        deadline: new Date(past),
      } as never);

      expect(db.request.update).toHaveBeenCalled();
    });

    it('при правке новый прошедший срок — 400', async () => {
      await expectBusinessError(
        () =>
          service.update('request-1', { deadline: daysFromNow(-1) } as never),
        { status: 400 },
      );
      expect(db.request.update).not.toHaveBeenCalled();
    });
  });

  describe('неожиданные ошибки', () => {
    it('сбой базы при создании пробрасывается как есть — фильтр ответит 500, а не 400', async () => {
      const failure = new Error('connection lost');
      db.request.create.mockRejectedValue(failure);

      await expect(service.create(createDto())).rejects.toBe(failure);
    });

    it('сбой базы при правке тоже не превращается в 400', async () => {
      const failure = new Error('connection lost');
      db.request.update.mockRejectedValue(failure);

      await expect(
        service.update('request-1', { description: 'Новое' } as never),
      ).rejects.toBe(failure);
    });
  });

  describe('редактирование заявки', () => {
    it('меняет описание и бюджет', async () => {
      await service.update('request-1', {
        description: 'Уточнил задачу',
        budget: 250000,
      });

      expect(db.request.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Уточнил задачу',
            budget: 250000,
          }),
        }),
      );
    });

    it('не переписывает заявку на другого студента', async () => {
      await service.update('request-1', {
        description: 'Попытка передать заявку',
        studentId: 'another-student',
      } as never);

      const data = db.request.update.mock.calls[0][0].data;
      expect(data.studentId).toBeUndefined();
    });

    it('смена предмета требует активной связи преподаватель-предмет', async () => {
      db.teacherSubject.findFirst.mockResolvedValue(null);

      await expectBusinessError(
        () => service.update('request-1', { subjectId: 'subject-2' }),
        { status: 400 },
      );
      expect(db.request.update).not.toHaveBeenCalled();
    });

    it('меняет предмет при существующей связи', async () => {
      db.teacherSubject.findFirst.mockResolvedValue({ id: 'ts-1' });

      await service.update('request-1', { subjectId: 'subject-2' });

      expect(db.request.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subjectId: 'subject-2' }),
        }),
      );
    });

    it('возвращает 404 по несуществующей заявке', async () => {
      db.request.findUnique.mockResolvedValue(null);

      await expectBusinessError(
        () => service.update('missing', { budget: 200000 }),
        { code: 'NOT_FOUND', status: 404 },
      );
    });
  });

  describe('лента', () => {
    beforeEach(() => {
      db.request.findMany.mockResolvedValue([]);
    });

    it('по умолчанию показывает только открытые заявки', async () => {
      await service.findAll({});

      const { where } = firstCallArg<ReadArg>(db.request.findMany);
      expect(where.status).toBe('OPEN');
    });

    it('автору отдаёт все его заявки, включая закрытые', async () => {
      await service.findAll({ studentId: STUDENT });

      const { where } = firstCallArg<ReadArg>(db.request.findMany);
      expect(where.status).toBeUndefined();
      expect(where.studentId).toBe(STUDENT);
    });
  });

  describe('закрытие заявки', () => {
    beforeEach(() => {
      db.requestResponse.findMany.mockResolvedValue([]);
      db.request.update.mockResolvedValue(requestRow({ status: 'CLOSED' }));
    });

    it('переводит заявку в CLOSED и помечает время', async () => {
      await service.close('request-1', STUDENT);

      const { data } = firstCallArg<WriteArg>(db.request.update);
      expect(data.status).toBe('CLOSED');
      expect(data.closedAt).toBeInstanceOf(Date);
    });

    it('отклоняет оставшиеся отклики', async () => {
      await service.close('request-1', STUDENT);

      expect(db.requestResponse.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: 'request-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'REJECTED' }) as unknown,
        }),
      );
    });

    it('доступно только автору', async () => {
      await expectBusinessError(() => service.close('request-1', TUTOR), {
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(db.request.update).not.toHaveBeenCalled();
    });

    it('не закрывает дважды', async () => {
      db.request.findUnique.mockResolvedValue(requestRow({ status: 'CLOSED' }));

      await expectBusinessError(() => service.close('request-1', STUDENT), {
        status: 400,
      });
      expect(db.request.update).not.toHaveBeenCalled();
    });
  });

  describe('переоткрытие заявки', () => {
    beforeEach(() => {
      db.request.findUnique.mockResolvedValue(requestRow({ status: 'CLOSED' }));
      db.request.create.mockResolvedValue(requestRow({ id: 'request-2' }));
    });

    it('создаёт новую публикацию с теми же условиями', async () => {
      await service.reopen('request-1', STUDENT);

      const { data } = firstCallArg<WriteArg>(db.request.create);
      expect(data.subjectId).toBe('subject-1');
      expect(data.budget).toBe(150000);
      expect(data.description).toBe('Нужна помощь с матанализом');
    });

    it('не воскрешает старые отклики', async () => {
      await service.reopen('request-1', STUDENT);

      expect(db.request.update).not.toHaveBeenCalled();
      expect(db.requestResponse.updateMany).not.toHaveBeenCalled();
    });

    it('не переоткрывает уже открытую заявку', async () => {
      db.request.findUnique.mockResolvedValue(requestRow());

      await expectBusinessError(() => service.reopen('request-1', STUDENT), {
        status: 400,
      });
      expect(db.request.create).not.toHaveBeenCalled();
    });

    it('доступно только автору', async () => {
      await expectBusinessError(() => service.reopen('request-1', TUTOR), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });
  });

  describe('удаление заявки', () => {
    it('удаляет существующую заявку', async () => {
      await service.remove('request-1');

      expect(db.request.delete).toHaveBeenCalledWith({
        where: { id: 'request-1' },
      });
    });

    it('возвращает 404 по несуществующей заявке', async () => {
      db.request.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.remove('missing'), {
        code: 'NOT_FOUND',
        status: 404,
      });
      expect(db.request.delete).not.toHaveBeenCalled();
    });
  });

  describe('заявки конкретного студента', () => {
    const findManyArg = () =>
      firstCallArg<ReadArg & { include: { responses: unknown } }>(
        db.request.findMany,
      );

    beforeEach(() => {
      db.request.findMany.mockResolvedValue([]);
    });

    it('чужим — только открытые заявки и без откликов', async () => {
      await service.findByStudent(STUDENT, TUTOR);

      expect(findManyArg().where).toEqual({
        studentId: STUDENT,
        status: 'OPEN',
      });
      expect(findManyArg().include.responses).toBe(false);
    });

    it('автору — все его заявки с откликами', async () => {
      await service.findByStudent(STUDENT, STUDENT);

      expect(findManyArg().where).toEqual({ studentId: STUDENT });
      expect(findManyArg().include.responses).toBeTruthy();
    });
  });
});
