import { Test } from '@nestjs/testing';
import { User } from '@prisma/client';
import { RequestResponsesService } from './request-responses.service';
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
import { RequestResponseFilterDto } from './dto/request-response.dto';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const OTHER_TUTOR = 'tutor-2';

const asUser = (id: string) => ({ id }) as User;

const request = (overrides: Record<string, unknown> = {}) => ({
  id: 'request-1',
  studentId: STUDENT,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  budget: 150000,
  deadline: new Date('2026-12-01'),
  student: { name: 'Студент' },
  subject: { name: 'Математика' },
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  id: 'rr-1',
  tutorId: TUTOR,
  requestId: 'request-1',
  status: 'PENDING',
  price: 200000,
  proposedDeadline: null,
  request: request(),
  ...overrides,
});

describe('RequestResponsesService', () => {
  let service: RequestResponsesService;
  let db: DatabaseMock;
  let notifications: ReturnType<typeof createNotificationMock>;

  beforeEach(async () => {
    db = createDatabaseMock();
    notifications = createNotificationMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestResponsesService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(RequestResponsesService);

    db.user.findUnique.mockResolvedValue({ id: TUTOR, name: 'Репетитор' });
    db.request.findUnique.mockResolvedValue(request());
    db.requestResponse.findFirst.mockResolvedValue(null);
    db.requestResponse.create.mockResolvedValue(response());
    db.requestResponse.findUnique.mockResolvedValue(response());
    db.deal.findFirst.mockResolvedValue(null);
    db.requestResponse.findMany.mockResolvedValue([]);
  });

  describe('создание отклика', () => {
    it('нельзя откликнуться от чужого имени', async () => {
      await expectBusinessError(
        () =>
          service.create(
            { tutorId: TUTOR, requestId: 'request-1' },
            asUser(OTHER_TUTOR),
          ),
        { status: 400 },
      );
      expect(db.requestResponse.create).not.toHaveBeenCalled();
    });

    it('нельзя откликнуться на собственную заявку', async () => {
      db.request.findUnique.mockResolvedValue(request({ studentId: TUTOR }));

      await expectBusinessError(
        () =>
          service.create(
            { tutorId: TUTOR, requestId: 'request-1' },
            asUser(TUTOR),
          ),
        { status: 400 },
      );
      expect(db.requestResponse.create).not.toHaveBeenCalled();
    });

    it('нельзя откликнуться дважды на одну заявку', async () => {
      db.requestResponse.findFirst.mockResolvedValue({ id: 'existing' });

      await expectBusinessError(
        () =>
          service.create(
            { tutorId: TUTOR, requestId: 'request-1' },
            asUser(TUTOR),
          ),
        { status: 400 },
      );
      expect(db.requestResponse.create).not.toHaveBeenCalled();
    });

    it('создаёт отклик и уведомляет автора заявки', async () => {
      await service.create(
        { tutorId: TUTOR, requestId: 'request-1', price: 200000 },
        asUser(TUTOR),
      );

      expect(db.requestResponse.create).toHaveBeenCalled();
      expect(notifications.notifyRequestResponseCreated).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT }),
      );
    });
  });

  describe('редактирование отклика', () => {
    it('доступно только автору', async () => {
      db.requestResponse.findUnique.mockResolvedValue(response());

      await expectBusinessError(
        () => service.update('rr-1', { price: 300000 }, asUser(OTHER_TUTOR)),
        { code: 'FORBIDDEN', status: 403 },
      );
      expect(db.requestResponse.update).not.toHaveBeenCalled();
    });

    it('запрещено после решения по отклику', async () => {
      db.requestResponse.findUnique.mockResolvedValue(
        response({ status: 'ACCEPTED' }),
      );

      await expectBusinessError(
        () => service.update('rr-1', { price: 300000 }, asUser(TUTOR)),
        { status: 400 },
      );
      expect(db.requestResponse.update).not.toHaveBeenCalled();
    });

    it('разрешено автору, пока отклик в статусе PENDING', async () => {
      db.requestResponse.findUnique.mockResolvedValue(response());
      db.requestResponse.update.mockResolvedValue(response());

      await service.update('rr-1', { price: 300000 }, asUser(TUTOR));

      expect(db.requestResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 300000 }),
        }),
      );
    });
  });

  describe('принятие отклика', () => {
    it('создаёт сделку и переводит отклик в ACCEPTED', async () => {
      db.deal.findFirst
        .mockResolvedValueOnce(null) // проверка существующей сделки
        .mockResolvedValueOnce({ id: 'deal-1', price: 200000 }); // сделка после создания

      await service.accept('rr-1', asUser(STUDENT));

      expect(db.requestResponse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
      expect(db.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: STUDENT,
            tutorId: TUTOR,
            price: 200000,
            status: 'PENDING',
            requestResponseId: 'rr-1',
          }),
        }),
      );
    });

    it('переводит заявку в MATCHED — она перестаёт собирать отклики', async () => {
      db.deal.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'deal-1', price: 200000 });

      await service.accept('rr-1', asUser(STUDENT));

      expect(db.request.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'request-1' },
          data: expect.objectContaining({ status: 'MATCHED' }) as unknown,
        }),
      );
    });

    it('отклоняет остальные отклики и уведомляет их авторов', async () => {
      db.requestResponse.findMany.mockResolvedValue([
        { id: 'other-1', tutorId: 'tutor-2' },
        { id: 'other-2', tutorId: 'tutor-3' },
      ]);
      db.deal.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'deal-1', price: 200000 });

      await service.accept('rr-1', asUser(STUDENT));

      expect(db.requestResponse.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['other-1', 'other-2'] } },
          data: expect.objectContaining({ status: 'REJECTED' }) as unknown,
        }),
      );
      expect(notifications.notifyRequestResponseRejected).toHaveBeenCalledTimes(
        2,
      );
    });

    it('цена сделки берётся из отклика', async () => {
      db.deal.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'deal-1', price: 200000 });

      await service.accept('rr-1', asUser(STUDENT));

      const { data } = firstCallArg<WriteArg>(db.deal.create);
      expect(data.price).toBe(200000);
      expect(data.studentId).toBe(STUDENT);
      expect(data.tutorId).toBe(TUTOR);
    });

    it('доступно только автору заявки', async () => {
      await expectBusinessError(
        () => service.accept('rr-1', asUser(OTHER_TUTOR)),
        { status: 400 },
      );
      expect(db.deal.create).not.toHaveBeenCalled();
    });

    it('нельзя принять уже обработанный отклик', async () => {
      db.requestResponse.findUnique.mockResolvedValue(
        response({ status: 'REJECTED' }),
      );

      await expectBusinessError(() => service.accept('rr-1', asUser(STUDENT)), {
        status: 400,
      });
      expect(db.deal.create).not.toHaveBeenCalled();
    });

    it('не создаёт вторую сделку по тому же отклику', async () => {
      db.deal.findFirst.mockResolvedValue({ id: 'deal-1' });

      await expectBusinessError(() => service.accept('rr-1', asUser(STUDENT)), {
        status: 400,
      });
      expect(db.deal.create).not.toHaveBeenCalled();
    });

    it('падает, если цена не определена ни в отклике, ни в заявке', async () => {
      db.requestResponse.findUnique.mockResolvedValue(
        response({ price: null, request: request({ budget: null }) }),
      );

      await expectBusinessError(() => service.accept('rr-1', asUser(STUDENT)), {
        status: 400,
      });
      expect(db.deal.create).not.toHaveBeenCalled();
    });

    it('берёт бюджет заявки, если репетитор не назвал цену', async () => {
      db.requestResponse.findUnique.mockResolvedValue(
        response({ price: null }),
      );
      db.deal.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'deal-1', price: 150000 });

      await service.accept('rr-1', asUser(STUDENT));

      expect(db.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 150000 }),
        }),
      );
    });
  });

  describe('удаление отклика', () => {
    it('доступно только автору', async () => {
      await expectBusinessError(
        () => service.remove('rr-1', asUser(OTHER_TUTOR)),
        { status: 400 },
      );
      expect(db.requestResponse.delete).not.toHaveBeenCalled();
    });

    it('автор может удалить свой отклик', async () => {
      await service.remove('rr-1', asUser(TUTOR));

      expect(db.requestResponse.delete).toHaveBeenCalledWith({
        where: { id: 'rr-1' },
      });
    });
  });

  describe('видимость откликов', () => {
    const OUTSIDER = 'outsider-1';
    const filter = (overrides: Record<string, unknown> = {}) =>
      ({
        page: 1,
        limit: 10,
        skip: 0,
        ...overrides,
      }) as unknown as RequestResponseFilterDto;
    const listWhere = () =>
      firstCallArg<ReadArg>(db.requestResponse.findMany).where;

    beforeEach(() => {
      db.requestResponse.findMany.mockResolvedValue([]);
      db.requestResponse.count.mockResolvedValue(0);
      db.review.groupBy.mockResolvedValue([]);
    });

    it('без role отдаёт свои отклики и отклики на свои заявки', async () => {
      await service.findAll(filter(), TUTOR);

      expect(listWhere().AND).toEqual([
        { OR: [{ tutorId: TUTOR }, { request: { studentId: TUTOR } }] },
      ]);
    });

    it('role=tutor — только свои отклики', async () => {
      await service.findAll(filter({ role: 'tutor' }), TUTOR);

      expect(listWhere().AND).toEqual([{ tutorId: TUTOR }]);
    });

    it('role=student — только отклики на свои заявки', async () => {
      await service.findAll(
        filter({ role: 'student', requestId: 'request-1' }),
        STUDENT,
      );

      expect(listWhere()).toMatchObject({
        requestId: 'request-1',
        AND: [{ request: { studentId: STUDENT } }],
      });
    });

    it('отдаёт страницу в формате { items, total, page, limit, totalPages }', async () => {
      db.requestResponse.findMany.mockResolvedValue([response()]);
      db.requestResponse.count.mockResolvedValue(11);

      await expect(service.findAll(filter(), TUTOR)).resolves.toMatchObject({
        total: 11,
        page: 1,
        limit: 10,
        totalPages: 2,
        items: [expect.objectContaining({ id: 'rr-1' })],
      });
    });

    it('отклик по id видят автор и автор заявки', async () => {
      db.requestResponse.findUnique.mockResolvedValue(response());

      await expect(
        service.findOneForUser('rr-1', TUTOR),
      ).resolves.toMatchObject({ id: 'rr-1' });
      await expect(
        service.findOneForUser('rr-1', STUDENT),
      ).resolves.toMatchObject({ id: 'rr-1' });
    });

    it('посторонний не видит отклик по id', async () => {
      db.requestResponse.findUnique.mockResolvedValue(response());

      await expectBusinessError(
        () => service.findOneForUser('rr-1', OUTSIDER),
        { code: 'FORBIDDEN', status: 403 },
      );
    });
  });
});
