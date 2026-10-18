import { Test } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { DatabaseService } from '../../../database/database.service';
import {
  createDatabaseMock,
  expectBusinessError,
  DatabaseMock,
} from '../../../test-support/mocks';

const TUTOR = 'tutor-1';
const STUDENT = 'student-1';

const serviceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'service-1',
  tutorId: TUTOR,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  price: 200000,
  status: 'ACTIVE',
  tutor: { id: TUTOR, name: 'Репетитор' },
  subject: { id: 'subject-1', name: 'Математика' },
  teacher: { id: 'teacher-1', fullName: 'Иванов И.И.' },
  ...overrides,
});

/** Репутация подмешивается в include-связь `tutor`, которой нет в типе Service */
const withTutor = (item: unknown) =>
  (item as { tutor: Record<string, unknown> }).tutor;

const createDto = (overrides: Record<string, unknown> = {}) =>
  ({
    subjectId: 'subject-1',
    teacherId: 'teacher-1',
    description: 'Подготовлю к экзамену',
    price: 200000,
    ...overrides,
  }) as never;

describe('ServicesService', () => {
  let service: ServicesService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [ServicesService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(ServicesService);

    db.user.findUnique.mockResolvedValue({ id: TUTOR, name: 'Репетитор' });
    db.subject.findUnique.mockResolvedValue({
      id: 'subject-1',
      name: 'Математика',
    });
    db.teacher.findUnique.mockResolvedValue({
      id: 'teacher-1',
      fullName: 'Иванов И.И.',
    });
    db.teacherSubject.findFirst.mockResolvedValue({ id: 'ts-1' });
    db.service.create.mockResolvedValue(serviceRow());
    db.service.findUnique.mockResolvedValue(serviceRow());
    db.service.update.mockResolvedValue(serviceRow());
    db.review.groupBy.mockResolvedValue([]);
    db.serviceResponse.findMany.mockResolvedValue([]);
  });

  describe('создание услуги', () => {
    it('привязывает услугу к текущему репетитору', async () => {
      await service.create(createDto(), TUTOR);

      expect(db.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tutorId: TUTOR }),
        }),
      );
    });

    it('возвращает 404 по несуществующему предмету', async () => {
      db.subject.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto(), TUTOR), {
        code: 'NOT_FOUND',
        status: 404,
      });
      expect(db.service.create).not.toHaveBeenCalled();
    });

    it('возвращает 404 по несуществующему преподавателю', async () => {
      db.teacher.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto(), TUTOR), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('требует, чтобы преподаватель вёл предмет (активная связь)', async () => {
      db.teacherSubject.findFirst.mockResolvedValue(null);

      await expectBusinessError(() => service.create(createDto(), TUTOR), {
        status: 400,
      });
      expect(db.teacherSubject.findFirst).toHaveBeenCalledWith({
        where: {
          teacherId: 'teacher-1',
          subjectId: 'subject-1',
          isActive: true,
        },
      });
      expect(db.service.create).not.toHaveBeenCalled();
    });
  });

  describe('витрина услуг', () => {
    beforeEach(() => {
      db.service.findMany.mockResolvedValue([serviceRow()]);
      db.service.count.mockResolvedValue(1);
    });

    it('по умолчанию показывает только активные услуги', async () => {
      await service.findAll({} as never);

      expect(db.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('уважает явный фильтр по статусу', async () => {
      await service.findAll({ status: 'INACTIVE' } as never);

      expect(db.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'INACTIVE' }),
        }),
      );
    });

    it('фильтрует по диапазону цены', async () => {
      await service.findAll({ minPrice: 100000, maxPrice: 300000 } as never);

      const args = db.service.findMany.mock.calls[0][0];
      expect(args.where.price).toEqual({ gte: 100000, lte: 300000 });
    });

    it('помечает свои услуги и те, на которые уже откликнулся', async () => {
      db.serviceResponse.findMany.mockResolvedValue([
        { serviceId: 'service-1' },
      ]);

      const own = await service.findAll({} as never, TUTOR);
      expect(own.items[0]).toMatchObject({
        isOwnService: true,
        currentUserResponded: true,
      });

      const foreign = await service.findAll({} as never, STUDENT);
      expect(foreign.items[0]).toMatchObject({ isOwnService: false });
    });

    it('не проставляет пользовательские флаги анонимному запросу', async () => {
      const result = await service.findAll({} as never);

      expect(result.items[0]).not.toHaveProperty('isOwnService');
      expect(db.serviceResponse.findMany).not.toHaveBeenCalled();
    });

    it('подмешивает рейтинг репетитора из отзывов', async () => {
      db.review.groupBy.mockResolvedValue([
        { targetId: TUTOR, _avg: { rating: 4.66 }, _count: { rating: 3 } },
      ]);

      const result = await service.findAll({} as never);

      expect(withTutor(result.items[0])).toMatchObject({
        rating: 4.7,
        reviewsCount: 3,
      });
    });

    it('репетитору без отзывов ставит null вместо выдуманного нуля', async () => {
      const result = await service.findAll({} as never);

      expect(withTutor(result.items[0])).toMatchObject({
        rating: null,
        reviewsCount: 0,
      });
    });
  });

  describe('изменение статуса', () => {
    it('деактивация переводит услугу в INACTIVE', async () => {
      await service.deactivate('service-1');

      expect(db.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INACTIVE' }),
        }),
      );
    });

    it('приостановка переводит услугу в SUSPENDED', async () => {
      await service.suspend('service-1');

      expect(db.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUSPENDED' }),
        }),
      );
    });

    it('смена предмета требует активной связи преподаватель-предмет', async () => {
      db.teacherSubject.findFirst.mockResolvedValue(null);

      await expectBusinessError(
        () => service.update('service-1', { subjectId: 'subject-2' } as never),
        { status: 400 },
      );
      expect(db.service.update).not.toHaveBeenCalled();
    });

    it('меняет предмет при существующей связи', async () => {
      db.teacherSubject.findFirst.mockResolvedValue({ id: 'ts-1' });

      await service.update('service-1', { subjectId: 'subject-2' } as never);

      expect(db.service.update).toHaveBeenCalled();
    });
  });

  describe('удаление услуги', () => {
    it('запрещено при активных откликах', async () => {
      db.serviceResponse.count.mockResolvedValue(2);
      db.deal.count.mockResolvedValue(0);

      await expectBusinessError(() => service.remove('service-1'), {
        status: 400,
      });
      expect(db.service.delete).not.toHaveBeenCalled();
    });

    it('запрещено при существующих сделках', async () => {
      db.serviceResponse.count.mockResolvedValue(0);
      db.deal.count.mockResolvedValue(1);

      await expectBusinessError(() => service.remove('service-1'), {
        status: 400,
      });
      expect(db.service.delete).not.toHaveBeenCalled();
    });

    it('разрешено, когда услуга ничем не связана', async () => {
      db.serviceResponse.count.mockResolvedValue(0);
      db.deal.count.mockResolvedValue(0);

      await service.remove('service-1');

      expect(db.service.delete).toHaveBeenCalledWith({
        where: { id: 'service-1' },
      });
    });

    it('возвращает 404 по несуществующей услуге', async () => {
      db.service.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.remove('missing'), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });
  });
});
