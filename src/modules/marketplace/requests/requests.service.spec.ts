import { Test } from '@nestjs/testing';
import { RequestsService } from './requests.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  firstCallArg,
  type DatabaseMock,
  type ReadArg,
  type WriteArg,
} from '../../../common/testing/mocks';

const STUDENT = 'student-1';
const REQUEST = 'request-1';

const openRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQUEST,
  studentId: STUDENT,
  subjectId: 'subject-1',
  teacherId: 'teacher-1',
  description: 'Нужна помощь с интегралами',
  budget: 200000,
  deadline: null,
  status: 'OPEN',
  ...overrides,
});

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
    db.request.findUnique.mockResolvedValue(openRequest());
    db.request.findMany.mockResolvedValue([]);
    db.requestResponse.findMany.mockResolvedValue([]);
    db.request.update.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({ ...openRequest(), ...data }),
    );
  });

  describe('лента', () => {
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

  describe('закрытие', () => {
    it('закрывает заявку и помечает время', async () => {
      await service.close(REQUEST, STUDENT);

      const { data } = firstCallArg<WriteArg>(db.request.update);
      expect(data.status).toBe('CLOSED');
      expect(data.closedAt).toBeInstanceOf(Date);
    });

    it('отклоняет оставшиеся отклики', async () => {
      await service.close(REQUEST, STUDENT);

      expect(db.requestResponse.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { requestId: REQUEST, status: 'PENDING' },
          data: expect.objectContaining({ status: 'REJECTED' }) as unknown,
        }),
      );
    });

    it('закрыть может только автор', async () => {
      await expect(service.close(REQUEST, 'stranger')).rejects.toThrow();
    });

    it('не закрывает дважды', async () => {
      db.request.findUnique.mockResolvedValue(
        openRequest({ status: 'CLOSED' }),
      );

      await expect(service.close(REQUEST, STUDENT)).rejects.toThrow();
    });
  });

  describe('переоткрытие', () => {
    beforeEach(() => {
      db.request.findUnique.mockResolvedValue(
        openRequest({ status: 'CLOSED' }),
      );
      db.request.create.mockResolvedValue(openRequest({ id: 'request-2' }));
    });

    it('создаёт новую публикацию с теми же условиями', async () => {
      await service.reopen(REQUEST, STUDENT);

      const { data } = firstCallArg<WriteArg>(db.request.create);
      expect(data.subjectId).toBe('subject-1');
      expect(data.budget).toBe(200000);
      expect(data.description).toBe('Нужна помощь с интегралами');
    });

    it('не воскрешает старые отклики', async () => {
      await service.reopen(REQUEST, STUDENT);

      // старая заявка остаётся закрытой, её отклики не трогаем
      expect(db.request.update).not.toHaveBeenCalled();
      expect(db.requestResponse.updateMany).not.toHaveBeenCalled();
    });

    it('не переоткрывает уже открытую заявку', async () => {
      db.request.findUnique.mockResolvedValue(openRequest());

      await expect(service.reopen(REQUEST, STUDENT)).rejects.toThrow();
    });
  });
});
