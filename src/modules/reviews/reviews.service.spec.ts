import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { DatabaseService } from '../../database/database.service';
import { NotificationService } from '../notifications/notification.service';
import {
  createNotificationMock,
  createPrismaMock,
  expectBusinessError,
  PrismaMock,
} from '../../test-support/mocks';

const STUDENT = 'student-1';
const TUTOR = 'tutor-1';
const OUTSIDER = 'outsider-1';

const completedDeal = (overrides: Record<string, unknown> = {}) => ({
  id: 'deal-1',
  studentId: STUDENT,
  tutorId: TUTOR,
  status: 'COMPLETED',
  student: { id: STUDENT, name: 'Студент' },
  tutor: { id: TUTOR, name: 'Репетитор' },
  ...overrides,
});

const createdReview = (data: Record<string, unknown>) => ({
  id: 'review-1',
  ...data,
  author: { id: data.authorId, name: 'Автор', telegramUsername: 'author' },
  target: { id: data.targetId, name: 'Получатель', telegramUsername: 'target' },
  deal: { subject: { name: 'Математика' } },
});

describe('ReviewsService', () => {
  let service: ReviewsService;
  let db: PrismaMock;
  let notifications: ReturnType<typeof createNotificationMock>;

  beforeEach(async () => {
    db = createPrismaMock();
    notifications = createNotificationMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: DatabaseService, useValue: db },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(ReviewsService);

    db.review.findFirst.mockResolvedValue(null);
    db.review.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(createdReview(data)),
    );
  });

  describe('создание отзыва', () => {
    it('студент оценивает репетитора: получатель и роль выводятся из сделки', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());

      await service.create({ dealId: 'deal-1', rating: 5 }, STUDENT);

      expect(db.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            authorId: STUDENT,
            targetId: TUTOR,
            targetRole: 'TUTOR',
            rating: 5,
          }),
        }),
      );
    });

    it('репетитор оценивает студента: роль получателя — STUDENT', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());

      await service.create({ dealId: 'deal-1', rating: 4 }, TUTOR);

      expect(db.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            authorId: TUTOR,
            targetId: STUDENT,
            targetRole: 'STUDENT',
          }),
        }),
      );
    });

    it('обе стороны могут оставить по отзыву на одну сделку', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());
      // отзыв второй стороны ищется по паре (dealId, authorId) — своего ещё нет
      db.review.findFirst.mockResolvedValue(null);

      await service.create({ dealId: 'deal-1', rating: 5 }, STUDENT);
      await service.create({ dealId: 'deal-1', rating: 4 }, TUTOR);

      expect(db.review.create).toHaveBeenCalledTimes(2);
      expect(db.review.findFirst).toHaveBeenLastCalledWith({
        where: { dealId: 'deal-1', authorId: TUTOR },
      });
    });

    it('не даёт одному автору оставить два отзыва по сделке', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());
      db.review.findFirst.mockResolvedValue({ id: 'review-1' });

      await expectBusinessError(
        () => service.create({ dealId: 'deal-1', rating: 5 }, STUDENT),
        { status: 400 },
      );
      expect(db.review.create).not.toHaveBeenCalled();
    });

    it('запрещён по незавершённой сделке', async () => {
      db.deal.findUnique.mockResolvedValue(
        completedDeal({ status: 'ACCEPTED' }),
      );

      await expectBusinessError(
        () => service.create({ dealId: 'deal-1', rating: 5 }, STUDENT),
        { status: 400 },
      );
      expect(db.review.create).not.toHaveBeenCalled();
    });

    it('запрещён для постороннего пользователя', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());

      await expectBusinessError(
        () => service.create({ dealId: 'deal-1', rating: 5 }, OUTSIDER),
        { status: 400 },
      );
      expect(db.review.create).not.toHaveBeenCalled();
    });

    it('возвращает 404 по несуществующей сделке', async () => {
      db.deal.findUnique.mockResolvedValue(null);

      await expectBusinessError(
        () => service.create({ dealId: 'missing', rating: 5 }, STUDENT),
        { code: 'NOT_FOUND', status: 404 },
      );
    });

    it('уведомляет получателя отзыва', async () => {
      db.deal.findUnique.mockResolvedValue(completedDeal());

      await service.create({ dealId: 'deal-1', rating: 5 }, STUDENT);

      expect(notifications.notifyReviewCreated).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: TUTOR, rating: 5 }),
      );
    });
  });

  describe('редактирование', () => {
    beforeEach(() => {
      db.review.findUnique.mockResolvedValue({
        id: 'review-1',
        dealId: 'deal-1',
        authorId: STUDENT,
        targetId: TUTOR,
      });
      db.review.update.mockResolvedValue({ id: 'review-1' });
    });

    it('меняет только оценку и комментарий', async () => {
      await service.update('review-1', { rating: 3, comment: 'Поправил' });

      expect(db.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rating: 3, comment: 'Поправил' }),
        }),
      );
    });

    it('не позволяет перепривязать отзыв к другой сделке', async () => {
      await expectBusinessError(
        () => service.update('review-1', { dealId: 'deal-2' }),
        { status: 400 },
      );
      expect(db.review.update).not.toHaveBeenCalled();
    });
  });

  describe('ответ на отзыв', () => {
    beforeEach(() => {
      db.review.findUnique.mockResolvedValue({
        id: 'review-1',
        dealId: 'deal-1',
        authorId: STUDENT,
        targetId: TUTOR,
      });
      db.review.update.mockResolvedValue({
        id: 'review-1',
        authorId: STUDENT,
        targetId: TUTOR,
        dealId: 'deal-1',
        target: { name: 'Репетитор' },
        deal: { subject: { name: 'Математика' } },
      });
    });

    it('оставляет тот, кому адресован отзыв', async () => {
      await service.setReply('review-1', TUTOR, { reply: 'Спасибо!' });

      expect(db.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reply: 'Спасибо!' }),
        }),
      );
      expect(notifications.notifyReviewReply).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserId: STUDENT }),
      );
    });

    it('пустая строка удаляет ответ', async () => {
      await service.setReply('review-1', TUTOR, { reply: '' });

      expect(db.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reply: null }),
        }),
      );
    });

    it('автор отзыва отвечать на него не может', async () => {
      await expectBusinessError(
        () => service.setReply('review-1', STUDENT, { reply: 'сам себе' }),
        { code: 'FORBIDDEN', status: 403 },
      );
      expect(db.review.update).not.toHaveBeenCalled();
    });
  });

  describe('репутация', () => {
    it('считается раздельно для роли репетитора и студента', async () => {
      db.review.findMany.mockImplementation(
        ({ where }: { where: { targetRole?: string } }) =>
          Promise.resolve(
            where.targetRole === 'TUTOR'
              ? [
                  { rating: 5, createdAt: new Date() },
                  { rating: 4, createdAt: new Date() },
                ]
              : [{ rating: 3, createdAt: new Date() }],
          ),
      );
      db.review.aggregate.mockImplementation(
        ({ where }: { where: { targetRole?: string } }) =>
          Promise.resolve({
            _avg: { rating: where.targetRole === 'TUTOR' ? 4.5 : 3 },
          }),
      );
      db.review.groupBy.mockResolvedValue([]);

      const reputation = await service.getReputation('user-1');

      expect(reputation).toEqual({
        tutor: { rating: 4.5, count: 2 },
        student: { rating: 3, count: 1 },
      });
    });

    it('у пользователя без отзывов репутация нулевая, а не ошибка', async () => {
      db.review.findMany.mockResolvedValue([]);
      db.review.aggregate.mockResolvedValue({ _avg: { rating: null } });
      db.review.groupBy.mockResolvedValue([]);

      await expect(service.getReputation('user-1')).resolves.toEqual({
        tutor: { rating: 0, count: 0 },
        student: { rating: 0, count: 0 },
      });
    });
  });
});
