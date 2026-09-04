import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { DatabaseService } from '../../database/database.service';
import { NotificationService } from '../notifications/notification.service';
import {
  createDatabaseMock,
  createNotificationMock,
  firstCallArg,
  type DatabaseMock,
  type WriteArg,
} from '../../common/testing/mocks';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const DEAL = 'deal-1';

const completedDeal = (overrides: Record<string, unknown> = {}) => ({
  id: DEAL,
  studentId: STUDENT,
  tutorId: TUTOR,
  status: 'COMPLETED',
  student: { id: STUDENT, name: 'Максим' },
  tutor: { id: TUTOR, name: 'Анна' },
  ...overrides,
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: createNotificationMock() },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);
    db.review.findFirst.mockResolvedValue(null);
    db.review.create.mockImplementation(({ data }: { data: object }) =>
      Promise.resolve({
        id: 'review-1',
        ...data,
        author: { name: 'Максим' },
        target: { name: 'Анна' },
        deal: { subject: { name: 'Мат. анализ' } },
      }),
    );
  });

  const create = (authorId: string) =>
    service.create({ dealId: DEAL, rating: 5 }, authorId);

  it('выводит получателя и его роль из сделки, а не из запроса', async () => {
    db.deal.findUnique.mockResolvedValue(completedDeal());

    await create(STUDENT);

    const { data } = firstCallArg<WriteArg>(db.review.create);
    expect(data.authorId).toBe(STUDENT);
    expect(data.targetId).toBe(TUTOR);
    expect(data.targetRole).toBe('TUTOR');
  });

  it('репетитор оценивает заказчика в роли STUDENT', async () => {
    db.deal.findUnique.mockResolvedValue(completedDeal());

    await create(TUTOR);

    const { data } = firstCallArg<WriteArg>(db.review.create);
    expect(data.targetId).toBe(STUDENT);
    expect(data.targetRole).toBe('STUDENT');
  });

  it('не принимает отзыв по незавершённой сделке', async () => {
    db.deal.findUnique.mockResolvedValue(
      completedDeal({ status: 'IN_PROGRESS' }),
    );

    await expect(create(STUDENT)).rejects.toThrow();
  });

  it('не принимает отзыв от постороннего', async () => {
    db.deal.findUnique.mockResolvedValue(completedDeal());

    await expect(create('stranger')).rejects.toThrow();
  });

  it('разрешает по одному отзыву с каждой стороны', async () => {
    db.deal.findUnique.mockResolvedValue(completedDeal());
    db.review.findFirst.mockResolvedValue({
      id: 'existing',
      authorId: STUDENT,
    });

    await expect(create(STUDENT)).rejects.toThrow();

    // проверка ищет отзыв именно этого автора, а не любой по сделке
    expect(db.review.findFirst).toHaveBeenCalledWith({
      where: { dealId: DEAL, authorId: STUDENT },
    });
  });

  describe('репутация', () => {
    it('считает рейтинг раздельно по ролям', async () => {
      db.review.findMany.mockResolvedValue([]);
      db.review.groupBy.mockResolvedValue([]);
      db.review.aggregate
        .mockResolvedValueOnce({ _avg: { rating: 4.86 } })
        .mockResolvedValueOnce({ _avg: { rating: 5 } });
      db.review.findMany
        .mockResolvedValueOnce([{ rating: 5, createdAt: new Date() }])
        .mockResolvedValueOnce([]);

      const reputation = await service.getReputation(TUTOR);

      expect(reputation.tutor.rating).toBe(4.9);
      expect(reputation.tutor.count).toBe(1);
      expect(reputation.student.count).toBe(0);
    });
  });
});
