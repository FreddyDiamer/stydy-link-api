import { Test } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { DatabaseService } from '../../../database/database.service';
import {
  createPrismaMock,
  expectBusinessError,
  PrismaMock,
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
  let db: PrismaMock;

  beforeEach(async () => {
    db = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [RequestsService, { provide: DatabaseService, useValue: db }],
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
});
