import { Test } from '@nestjs/testing';
import { DealsService } from './deals.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  firstCallArg,
  type DatabaseMock,
  type WriteArg,
} from '../../../common/testing/mocks';

interface AutoConfirmWhere {
  where: { AND: { OR: Record<string, unknown>[] }[] };
}

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const DEAL = 'deal-1';

const makeDeal = (overrides: Record<string, unknown> = {}) => ({
  id: DEAL,
  studentId: STUDENT,
  tutorId: TUTOR,
  status: 'IN_PROGRESS',
  price: 140000,
  deadline: null,
  studentConfirmedAt: null,
  tutorConfirmedAt: null,
  student: { name: 'Максим' },
  tutor: { name: 'Анна' },
  subject: { name: 'Мат. анализ' },
  ...overrides,
});

describe('DealsService', () => {
  let service: DealsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: createNotificationMock() },
      ],
    }).compile();

    service = moduleRef.get(DealsService);
    db.deal.update.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...makeDeal(), ...data }),
    );
  });

  describe('подтверждение выполнения', () => {
    it('участник, подтвердивший первым, не закрывает сделку в одиночку', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal());

      await service.complete(DEAL, STUDENT);

      const { data } = firstCallArg<WriteArg>(db.deal.update);
      expect(data.studentConfirmedAt).toBeInstanceOf(Date);
      expect(data.status).toBeUndefined();
    });

    it('закрывает сделку, когда подтвердила вторая сторона', async () => {
      db.deal.findUnique.mockResolvedValue(
        makeDeal({ tutorConfirmedAt: new Date('2026-06-24') }),
      );

      await service.complete(DEAL, STUDENT);

      const { data } = firstCallArg<WriteArg>(db.deal.update);
      expect(data.status).toBe('COMPLETED');
    });

    it('не даёт подтвердить дважды', async () => {
      db.deal.findUnique.mockResolvedValue(
        makeDeal({ studentConfirmedAt: new Date('2026-06-24') }),
      );

      await expect(service.complete(DEAL, STUDENT)).rejects.toThrow();
    });

    it('не даёт подтвердить завершённую сделку', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal({ status: 'COMPLETED' }));

      await expect(service.complete(DEAL, STUDENT)).rejects.toThrow();
    });

    it('не пускает постороннего', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal());

      await expect(service.complete(DEAL, 'stranger')).rejects.toThrow();
    });
  });

  describe('работа ещё не готова', () => {
    it('снимает подтверждение второй стороны', async () => {
      db.deal.findUnique.mockResolvedValue(
        makeDeal({ tutorConfirmedAt: new Date('2026-06-24') }),
      );

      await service.reopen(DEAL, STUDENT);

      const { data } = firstCallArg<WriteArg>(db.deal.update);
      expect(data.tutorConfirmedAt).toBeNull();
    });

    it('нечего снимать, если вторая сторона не подтверждала', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal());

      await expect(service.reopen(DEAL, STUDENT)).rejects.toThrow();
    });
  });

  describe('авто-подтверждение', () => {
    const findAll = () =>
      service.findAll({ page: 1, limit: 10, skip: 0 }, {} as never);

    beforeEach(() => {
      db.deal.findMany.mockResolvedValue([]);
      db.deal.count.mockResolvedValue(0);
    });

    it('закрывает сделку, где вторая сторона молчит дольше срока', async () => {
      await findAll();

      const { where } = firstCallArg<AutoConfirmWhere>(db.deal.updateMany);
      const [silence] = where.AND;
      expect(silence.OR).toHaveLength(2);
      expect(silence.OR[0].tutorConfirmedAt).toBeNull();
    });

    it('не закрывает раньше собственного дедлайна сделки', async () => {
      await findAll();

      const { where } = firstCallArg<AutoConfirmWhere>(db.deal.updateMany);
      const [, deadlineGuard] = where.AND;
      // длинная работа не должна закрыться до своего срока
      expect(deadlineGuard.OR).toEqual([
        { deadline: null },
        { deadline: { lt: expect.any(Date) as unknown } },
      ]);
    });

    it('отдаёт фронту момент авто-закрытия', async () => {
      const confirmedAt = new Date('2026-06-24T00:00:00.000Z');
      db.deal.findMany.mockResolvedValue([
        makeDeal({ studentConfirmedAt: confirmedAt }),
      ]);

      const result = await findAll();
      const [item] = result.items as unknown as { autoConfirmAt: Date }[];

      const expected = new Date(confirmedAt);
      expected.setDate(expected.getDate() + 7);
      expect(item.autoConfirmAt).toEqual(expected);
    });

    it('таймер не идёт, когда подтвердили обе стороны', async () => {
      db.deal.findMany.mockResolvedValue([
        makeDeal({
          studentConfirmedAt: new Date('2026-06-24'),
          tutorConfirmedAt: new Date('2026-06-25'),
        }),
      ]);

      const result = await findAll();
      const [item] = result.items as unknown as {
        autoConfirmAt: Date | null;
      }[];

      expect(item.autoConfirmAt).toBeNull();
    });
  });

  describe('отмена', () => {
    it('фиксирует, кто, когда и почему отменил', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal());

      await service.cancel(DEAL, STUDENT, 'Не совпало расписание');

      const { data } = firstCallArg<WriteArg>(db.deal.update);
      expect(data.status).toBe('CANCELLED');
      expect(data.cancelledById).toBe(STUDENT);
      expect(data.cancelReason).toBe('Не совпало расписание');
      expect(data.cancelledAt).toBeInstanceOf(Date);
    });

    it('не отменяет завершённую сделку', async () => {
      db.deal.findUnique.mockResolvedValue(makeDeal({ status: 'COMPLETED' }));

      await expect(service.cancel(DEAL, STUDENT)).rejects.toThrow();
    });
  });
});
