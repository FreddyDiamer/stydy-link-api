import { Test } from '@nestjs/testing';
import { User } from '@prisma/client';
import { ServiceResponsesService } from './service-responses.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createNotificationMock,
  createDatabaseMock,
  expectBusinessError,
  DatabaseMock,
  firstCallArg,
  ReadArg,
} from '../../../test-support/mocks';
import { ServiceResponseFilterDto } from './dto/service-response.dto';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const OUTSIDER = 'outsider-1';

const asUser = (id: string) => ({ id }) as User;

const service = (overrides: Record<string, unknown> = {}) => ({
  id: 'service-1',
  tutorId: TUTOR,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  price: 150000,
  status: 'ACTIVE',
  tutor: { id: TUTOR, name: 'Репетитор' },
  subject: { name: 'Математика' },
  teacher: { fullName: 'Иванов И.И.' },
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  id: 'sr-1',
  studentId: STUDENT,
  serviceId: 'service-1',
  status: 'PENDING',
  price: 200000,
  service: {
    tutor: { id: TUTOR, name: 'Репетитор' },
    subject: { name: 'Математика' },
  },
  ...overrides,
});

describe('ServiceResponsesService', () => {
  let sut: ServiceResponsesService;
  let db: DatabaseMock;
  let notifications: ReturnType<typeof createNotificationMock>;

  beforeEach(async () => {
    db = createDatabaseMock();
    notifications = createNotificationMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ServiceResponsesService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    sut = moduleRef.get(ServiceResponsesService);

    db.user.findUnique.mockResolvedValue({ id: STUDENT, name: 'Студент' });
    db.service.findUnique.mockResolvedValue(service());
    db.serviceResponse.findFirst.mockResolvedValue(null);
    db.serviceResponse.create.mockResolvedValue(response());
    db.serviceResponse.findUnique.mockResolvedValue(response());
    db.serviceResponse.update.mockResolvedValue(response());
    db.deal.findFirst.mockResolvedValue(null);
    db.deal.create.mockResolvedValue({ id: 'deal-1', price: 200000 });
  });

  describe('создание отклика', () => {
    it('создаёт отклик и уведомляет владельца услуги', async () => {
      await sut.create({ studentId: STUDENT, serviceId: 'service-1' });

      expect(db.serviceResponse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: STUDENT,
            serviceId: 'service-1',
            status: 'PENDING',
          }),
        }),
      );
      expect(notifications.notifyServiceResponseCreated).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: TUTOR }),
      );
    });

    it('нельзя откликнуться на собственную услугу', async () => {
      await expectBusinessError(
        () => sut.create({ studentId: TUTOR, serviceId: 'service-1' }),
        { status: 400 },
      );
      expect(db.serviceResponse.create).not.toHaveBeenCalled();
    });

    it('нельзя откликнуться на неактивную услугу', async () => {
      db.service.findUnique.mockResolvedValue(service({ status: 'SUSPENDED' }));

      await expectBusinessError(
        () => sut.create({ studentId: STUDENT, serviceId: 'service-1' }),
        { status: 400 },
      );
      expect(db.serviceResponse.create).not.toHaveBeenCalled();
    });

    it('нельзя откликнуться дважды на одну услугу', async () => {
      db.serviceResponse.findFirst.mockResolvedValue({ id: 'existing' });

      await expectBusinessError(
        () => sut.create({ studentId: STUDENT, serviceId: 'service-1' }),
        { status: 400 },
      );
      expect(db.serviceResponse.create).not.toHaveBeenCalled();
    });

    it('возвращает 404 по несуществующей услуге', async () => {
      db.service.findUnique.mockResolvedValue(null);

      await expectBusinessError(
        () => sut.create({ studentId: STUDENT, serviceId: 'missing' }),
        { code: 'NOT_FOUND', status: 404 },
      );
    });
  });

  describe('редактирование отклика', () => {
    it('запрещено после решения по отклику', async () => {
      db.serviceResponse.findUnique.mockResolvedValue(
        response({ status: 'ACCEPTED' }),
      );

      await expectBusinessError(() => sut.update('sr-1', { price: 300000 }), {
        status: 400,
      });
      expect(db.serviceResponse.update).not.toHaveBeenCalled();
    });

    it('меняет содержание отклика в статусе PENDING', async () => {
      await sut.update('sr-1', { price: 300000, message: 'Уточнил' });

      expect(db.serviceResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            price: 300000,
            message: 'Уточнил',
          }),
        }),
      );
    });

    it('не позволяет клиенту протащить статус через обновление', async () => {
      await sut.update('sr-1', {
        message: 'Хитрость',
        status: 'ACCEPTED',
      } as never);

      const data = (
        db.serviceResponse.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        }
      ).data;
      expect(data.status).toBeUndefined();
    });
  });

  describe('решение по отклику', () => {
    it('принимает отклик владелец услуги и создаёт сделку', async () => {
      await sut.accept('sr-1', asUser(TUTOR));

      expect(db.serviceResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
      // принятие и есть сделка: цена из отклика, связь через serviceResponseId
      expect(db.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: STUDENT,
            tutorId: TUTOR,
            subjectId: 'subject-1',
            teacherId: 'teacher-1',
            price: 200000,
            status: 'PENDING',
            serviceResponseId: 'sr-1',
          }),
        }),
      );
      expect(notifications.notifyServiceResponseAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT }),
      );
    });

    it('без цены в отклике сделка берёт цену услуги', async () => {
      db.serviceResponse.findUnique.mockResolvedValue(
        response({ price: null }),
      );

      await sut.accept('sr-1', asUser(TUTOR));

      expect(db.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 150000 }),
        }),
      );
    });

    it('не создаёт вторую сделку по тому же отклику', async () => {
      db.deal.findFirst.mockResolvedValue({ id: 'deal-1' });

      await expectBusinessError(() => sut.accept('sr-1', asUser(TUTOR)), {
        status: 400,
      });
      expect(db.deal.create).not.toHaveBeenCalled();
    });

    it('посторонний не может принять отклик', async () => {
      await expectBusinessError(() => sut.accept('sr-1', asUser(OUTSIDER)), {
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(db.serviceResponse.update).not.toHaveBeenCalled();
    });

    it('автор отклика не может принять его сам', async () => {
      await expectBusinessError(() => sut.accept('sr-1', asUser(STUDENT)), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });

    it('нельзя принять уже обработанный отклик', async () => {
      db.serviceResponse.findUnique.mockResolvedValue(
        response({ status: 'REJECTED' }),
      );

      await expectBusinessError(() => sut.accept('sr-1', asUser(TUTOR)), {
        status: 400,
      });
      expect(db.serviceResponse.update).not.toHaveBeenCalled();
    });

    it('отклоняет отклик владелец услуги', async () => {
      await sut.reject('sr-1', asUser(TUTOR));

      expect(db.serviceResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
      expect(notifications.notifyServiceResponseRejected).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT }),
      );
    });

    it('посторонний не может отклонить отклик', async () => {
      await expectBusinessError(() => sut.reject('sr-1', asUser(OUTSIDER)), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });
  });

  describe('видимость откликов', () => {
    const query = (overrides: Record<string, unknown> = {}) =>
      ({
        page: 1,
        limit: 10,
        skip: 0,
        ...overrides,
      }) as unknown as ServiceResponseFilterDto;
    const listWhere = () =>
      firstCallArg<ReadArg>(db.serviceResponse.findMany).where;

    beforeEach(() => {
      db.serviceResponse.findMany.mockResolvedValue([]);
      db.serviceResponse.count.mockResolvedValue(0);
    });

    it('без role отдаёт свои отклики и отклики на свои услуги', async () => {
      await sut.findAll(query(), query(), STUDENT);

      expect(listWhere().AND).toEqual([
        { OR: [{ studentId: STUDENT }, { service: { tutorId: STUDENT } }] },
      ]);
    });

    it('role=student — только свои отклики', async () => {
      await sut.findAll(
        query({ role: 'student' }),
        query({ role: 'student' }),
        STUDENT,
      );

      expect(listWhere().AND).toEqual([{ studentId: STUDENT }]);
    });

    it('role=tutor — только отклики на свои услуги', async () => {
      await sut.findAll(
        query({ role: 'tutor' }),
        query({ role: 'tutor' }),
        TUTOR,
      );

      expect(listWhere().AND).toEqual([{ service: { tutorId: TUTOR } }]);
    });

    it('фильтр по чужому studentId не расширяет область видимости', async () => {
      const filter = query({ studentId: OUTSIDER });
      await sut.findAll(filter, filter, STUDENT);

      expect(listWhere()).toMatchObject({
        studentId: OUTSIDER,
        AND: [
          { OR: [{ studentId: STUDENT }, { service: { tutorId: STUDENT } }] },
        ],
      });
    });

    it('отклик по id видят автор и владелец услуги', async () => {
      db.serviceResponse.findUnique.mockResolvedValue(
        response({ service: { tutorId: TUTOR } }),
      );

      await expect(sut.findOneForUser('sr-1', STUDENT)).resolves.toMatchObject({
        id: 'sr-1',
      });
      await expect(sut.findOneForUser('sr-1', TUTOR)).resolves.toMatchObject({
        id: 'sr-1',
      });
    });

    it('посторонний не видит отклик по id', async () => {
      db.serviceResponse.findUnique.mockResolvedValue(
        response({ service: { tutorId: TUTOR } }),
      );

      await expectBusinessError(() => sut.findOneForUser('sr-1', OUTSIDER), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });
  });
});
