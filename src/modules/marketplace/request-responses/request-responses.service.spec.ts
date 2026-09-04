import { Test } from '@nestjs/testing';
import { RequestResponsesService } from './request-responses.service';
import { DatabaseService } from '../../../database/database.service';
import { NotificationService } from '../../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  firstCallArg,
  type DatabaseMock,
  type WriteArg,
} from '../../../common/testing/mocks';
import type { User } from '@prisma/client';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const REQUEST = 'request-1';
const RESPONSE = 'response-1';

const asUser = (id: string) => ({ id }) as User;

const pendingResponse = (overrides: Record<string, unknown> = {}) => ({
  id: RESPONSE,
  tutorId: TUTOR,
  requestId: REQUEST,
  status: 'PENDING',
  price: 130000,
  proposedDeadline: null,
  request: {
    id: REQUEST,
    studentId: STUDENT,
    subjectId: 'subject-1',
    teacherId: 'teacher-1',
    budget: 200000,
    deadline: null,
    student: { name: 'Максим' },
    subject: { name: 'Химия' },
  },
  ...overrides,
});

describe('RequestResponsesService · выбор репетитора', () => {
  let service: RequestResponsesService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestResponsesService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: createNotificationMock() },
      ],
    }).compile();

    service = moduleRef.get(RequestResponsesService);
    db.requestResponse.findUnique.mockResolvedValue(pendingResponse());
    db.requestResponse.findMany.mockResolvedValue([]);
    db.deal.findFirst.mockResolvedValue(null);
    db.deal.create.mockResolvedValue({ id: 'deal-1', price: 130000 });
  });

  it('переводит заявку в «репетитор найден»', async () => {
    await service.accept(RESPONSE, asUser(STUDENT));

    expect(db.request.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: REQUEST },
        data: expect.objectContaining({ status: 'MATCHED' }) as unknown,
      }),
    );
  });

  it('закрывает остальные отклики, чтобы они не ждали вечно', async () => {
    db.requestResponse.findMany.mockResolvedValue([
      { id: 'other-1', tutorId: 'tutor-2' },
      { id: 'other-2', tutorId: 'tutor-3' },
    ]);

    await service.accept(RESPONSE, asUser(STUDENT));

    expect(db.requestResponse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['other-1', 'other-2'] } },
        data: expect.objectContaining({ status: 'REJECTED' }) as unknown,
      }),
    );
  });

  it('создаёт сделку по цене отклика', async () => {
    await service.accept(RESPONSE, asUser(STUDENT));

    const { data } = firstCallArg<WriteArg>(db.deal.create);
    expect(data.price).toBe(130000);
    expect(data.studentId).toBe(STUDENT);
    expect(data.tutorId).toBe(TUTOR);
  });

  it('принять отклик может только автор заявки', async () => {
    await expect(service.accept(RESPONSE, asUser(TUTOR))).rejects.toThrow();
  });

  it('не принимает уже обработанный отклик', async () => {
    db.requestResponse.findUnique.mockResolvedValue(
      pendingResponse({ status: 'REJECTED' }),
    );

    await expect(service.accept(RESPONSE, asUser(STUDENT))).rejects.toThrow();
  });

  it('не создаёт вторую сделку по одному отклику', async () => {
    db.deal.findFirst.mockResolvedValue({ id: 'deal-existing' });

    await expect(service.accept(RESPONSE, asUser(STUDENT))).rejects.toThrow();
  });
});
