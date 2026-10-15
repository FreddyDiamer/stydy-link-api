import { Test } from '@nestjs/testing';
import { DealsService } from './deals.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  expectBusinessError,
  firstCallArg,
  type DatabaseMock,
  type WriteArg,
} from '../../../test-support/mocks';

/** Аргумент авто-подтверждения: молчание второй стороны И дедлайн сделки */
interface AutoConfirmArg {
  where: { AND: { OR: Record<string, unknown>[] }[] };
}

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const OUTSIDER = 'outsider-1';

const baseDeal = (overrides: Record<string, unknown> = {}) => ({
  id: 'deal-1',
  studentId: STUDENT,
  tutorId: TUTOR,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  price: 100000,
  status: 'ACCEPTED',
  studentConfirmedAt: null,
  tutorConfirmedAt: null,
  student: { id: STUDENT, name: 'Студент' },
  tutor: { id: TUTOR, name: 'Репетитор' },
  subject: { name: 'Математика' },
  ...overrides,
});

describe('DealsService', () => {
  let service: DealsService;
  let db: DatabaseMock;
  let notifications: ReturnType<typeof createNotificationMock>;

  beforeEach(async () => {
    db = createDatabaseMock();
    notifications = createNotificationMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(DealsService);

    // Участники и справочники существуют, если тест не задал иное
    db.user.findUnique.mockResolvedValue({ id: 'someone', name: 'Кто-то' });
    db.subject.findUnique.mockResolvedValue({
      id: 'subject-1',
      name: 'Математика',
    });
    db.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
    db.deal.findFirst.mockResolvedValue(null);
    db.deal.create.mockResolvedValue({ id: 'deal-1', price: 100000 });
  });

  describe('доступ к чужим сделкам', () => {
    it('список ограничен сделками текущего пользователя', async () => {
      db.deal.findMany.mockResolvedValue([]);
      db.deal.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, skip: 0 }, {}, STUDENT);

      expect(db.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ studentId: STUDENT }, { tutorId: STUDENT }],
          }),
        }),
      );
    });

    it('role=tutor оставляет сделки, где текущий пользователь — репетитор', async () => {
      db.deal.findMany.mockResolvedValue([]);
      db.deal.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 10, skip: 0 },
        { role: 'tutor' },
        STUDENT,
      );

      expect(db.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ studentId: STUDENT }, { tutorId: STUDENT }],
            tutorId: STUDENT,
          }),
        }),
      );
    });

    it('отдаёт сделку участнику', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal());

      await expect(
        service.findOneForUser('deal-1', TUTOR),
      ).resolves.toMatchObject({ id: 'deal-1' });
    });

    it('не отдаёт сделку постороннему', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal());

      await expectBusinessError(
        () => service.findOneForUser('deal-1', OUTSIDER),
        { code: 'FORBIDDEN', status: 403 },
      );
    });

    it('не даёт постороннему менять статус сделки', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal({ status: 'PENDING' }));

      await expectBusinessError(() => service.accept('deal-1', OUTSIDER), {
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(db.deal.update).not.toHaveBeenCalled();
    });
  });

  describe('принятие и отклонение', () => {
    it('принимает сделку в статусе PENDING', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal({ status: 'PENDING' }));
      db.deal.update.mockResolvedValue(baseDeal({ status: 'ACCEPTED' }));

      await service.accept('deal-1', TUTOR);

      expect(db.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACCEPTED' }),
        }),
      );
      expect(notifications.notifyDealAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT }),
      );
    });

    it('не принимает сделку вне статуса PENDING', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal({ status: 'ACCEPTED' }));

      await expectBusinessError(() => service.accept('deal-1', TUTOR), {
        status: 400,
      });
      expect(db.deal.update).not.toHaveBeenCalled();
    });
  });

  describe('двустороннее подтверждение выполнения', () => {
    it('первое подтверждение не закрывает сделку', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal());
      db.deal.update.mockResolvedValue(baseDeal());

      await service.complete('deal-1', STUDENT);

      const updateArgs = db.deal.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.studentConfirmedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBeUndefined();
    });

    it('второе подтверждение закрывает сделку', async () => {
      db.deal.findUnique.mockResolvedValue(
        baseDeal({ studentConfirmedAt: new Date() }),
      );
      db.deal.update.mockResolvedValue(baseDeal({ status: 'COMPLETED' }));

      await service.complete('deal-1', TUTOR);

      const updateArgs = db.deal.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateArgs.data.tutorConfirmedAt).toBeInstanceOf(Date);
      expect(updateArgs.data.status).toBe('COMPLETED');
    });

    it('не даёт подтвердить дважды с одной стороны', async () => {
      db.deal.findUnique.mockResolvedValue(
        baseDeal({ studentConfirmedAt: new Date() }),
      );

      await expectBusinessError(() => service.complete('deal-1', STUDENT), {
        status: 400,
      });
      expect(db.deal.update).not.toHaveBeenCalled();
    });

    it('не подтверждает уже отменённую сделку', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal({ status: 'CANCELLED' }));

      await expectBusinessError(() => service.complete('deal-1', STUDENT), {
        status: 400,
      });
    });

    it('закрывает сделку, где вторая сторона молчит дольше срока', async () => {
      db.deal.findMany.mockResolvedValue([]);
      db.deal.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, skip: 0 }, {}, STUDENT);

      // просроченные сделки сначала выбираются: их участников надо уведомить
      const { where } = firstCallArg<AutoConfirmArg>(db.deal.findMany);
      const [silence] = where.AND;
      expect(silence.OR).toHaveLength(2);
      expect(silence.OR[0].tutorConfirmedAt).toBeNull();
      // нечего закрывать — нечего и обновлять
      expect(db.deal.updateMany).not.toHaveBeenCalled();
    });

    it('закрывает просроченные сделки и уведомляет обе стороны', async () => {
      db.deal.findMany
        .mockResolvedValueOnce([
          {
            id: 'deal-1',
            studentId: STUDENT,
            tutorId: TUTOR,
            subject: { name: 'Математика' },
          },
        ])
        .mockResolvedValueOnce([]);
      db.deal.count.mockResolvedValue(0);

      await service.autoConfirmSweep();

      expect(db.deal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['deal-1'] } },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(notifications.notifyDealCompleted).toHaveBeenCalledTimes(2);
      expect(notifications.notifyDealCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT, dealId: 'deal-1' }),
      );
      expect(notifications.notifyDealCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: TUTOR, dealId: 'deal-1' }),
      );
    });

    it('не закрывает раньше собственного дедлайна сделки', async () => {
      db.deal.findMany.mockResolvedValue([]);
      db.deal.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, skip: 0 }, {}, STUDENT);

      const { where } = firstCallArg<AutoConfirmArg>(db.deal.findMany);
      const [, deadlineGuard] = where.AND;
      // длинную работу нельзя закрыть до её собственного срока
      expect(deadlineGuard.OR).toEqual([
        { deadline: null },
        { deadline: { lt: expect.any(Date) as unknown } },
      ]);
    });

    it('отдаёт фронту момент авто-закрытия', async () => {
      const confirmedAt = new Date('2026-06-24T00:00:00.000Z');
      db.deal.findMany.mockResolvedValue([
        baseDeal({ studentConfirmedAt: confirmedAt, deadline: null }),
      ]);
      db.deal.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, skip: 0 },
        {},
        STUDENT,
      );
      const [item] = result.items as unknown as { autoConfirmAt: Date }[];

      const expected = new Date(confirmedAt);
      expected.setDate(expected.getDate() + 7);
      expect(item.autoConfirmAt).toEqual(expected);
    });

    it('таймер не идёт, когда подтвердили обе стороны', async () => {
      db.deal.findMany.mockResolvedValue([
        baseDeal({
          studentConfirmedAt: new Date('2026-06-24'),
          tutorConfirmedAt: new Date('2026-06-25'),
        }),
      ]);
      db.deal.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, skip: 0 },
        {},
        STUDENT,
      );
      const [item] = result.items as unknown as {
        autoConfirmAt: Date | null;
      }[];

      expect(item.autoConfirmAt).toBeNull();
    });
  });

  describe('работа ещё не готова', () => {
    it('снимает подтверждение второй стороны', async () => {
      db.deal.findUnique.mockResolvedValue(
        baseDeal({ tutorConfirmedAt: new Date('2026-06-24') }),
      );
      db.deal.update.mockResolvedValue(baseDeal());

      await service.reopen('deal-1', STUDENT);

      const { data } = firstCallArg<WriteArg>(db.deal.update);
      expect(data.tutorConfirmedAt).toBeNull();
    });

    it('нечего снимать, если вторая сторона не подтверждала', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal());

      await expectBusinessError(() => service.reopen('deal-1', STUDENT), {
        status: 400,
      });
      expect(db.deal.update).not.toHaveBeenCalled();
    });

    it('не пускает постороннего', async () => {
      db.deal.findUnique.mockResolvedValue(
        baseDeal({ tutorConfirmedAt: new Date('2026-06-24') }),
      );

      await expectBusinessError(() => service.reopen('deal-1', OUTSIDER), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });
  });

  describe('отмена', () => {
    it('сохраняет причину и автора отмены', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal());
      db.deal.update.mockResolvedValue(baseDeal({ status: 'CANCELLED' }));

      await service.cancel('deal-1', STUDENT, 'Не совпало расписание');

      expect(db.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledById: STUDENT,
            cancelReason: 'Не совпало расписание',
          }),
        }),
      );
      expect(notifications.notifyDealRejectedOrCancelled).toHaveBeenCalled();
    });

    it('не отменяет завершённую сделку', async () => {
      db.deal.findUnique.mockResolvedValue(baseDeal({ status: 'COMPLETED' }));

      await expectBusinessError(
        () => service.cancel('deal-1', STUDENT, 'поздно'),
        { status: 400 },
      );
      expect(db.deal.update).not.toHaveBeenCalled();
    });
  });
});
