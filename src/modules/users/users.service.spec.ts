import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserFilterDto } from './dto/user.dto';
import { DatabaseService } from '../../database/database.service';
import {
  createDatabaseMock,
  expectBusinessError,
  DatabaseMock,
} from '../../test-support/mocks';

/** Поля, которые не должны утекать в публичные ответы */
const PRIVATE_FIELDS = [
  'telegramId',
  'balance',
  'notificationPreferences',
  'telegramNotificationsEnabled',
];

describe('UsersService', () => {
  let service: UsersService;
  let db: DatabaseMock;

  beforeEach(async () => {
    db = createDatabaseMock();

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: DatabaseService, useValue: db }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('публичные профили', () => {
    it('список пользователей не отдаёт приватные поля', async () => {
      db.user.findMany.mockResolvedValue([]);
      db.user.count.mockResolvedValue(0);

      // пагинация и фильтр — один query-объект
      const query = { page: 1, limit: 10, skip: 0 } as UserFilterDto;
      await service.findAll(query, query);

      const args = db.user.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(args.select).toBeDefined();
      for (const field of PRIVATE_FIELDS) {
        expect(args.select[field]).toBeUndefined();
      }
      expect(args.select.id).toBe(true);
      expect(args.select.name).toBe(true);
    });

    it('профиль по id не отдаёт приватные поля', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1', name: 'Пётр' });

      await service.findPublicById('user-1');

      const args = db.user.findUnique.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      for (const field of PRIVATE_FIELDS) {
        expect(args.select[field]).toBeUndefined();
      }
    });

    it('возвращает 404 по несуществующему пользователю', async () => {
      db.user.findUnique.mockResolvedValue(null);

      await expectBusinessError(() => service.findPublicById('missing'), {
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('свой профиль отдаётся целиком', async () => {
      db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        telegramId: '123',
        balance: 5000,
      });

      const me = await service.findOne('user-1');

      expect(me).toMatchObject({ telegramId: '123', balance: 5000 });
    });
  });

  describe('статистика', () => {
    beforeEach(() => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1', balance: 5000 });
      db.service.count.mockResolvedValue(2);
      db.request.count.mockResolvedValue(1);
      db.deal.count.mockResolvedValue(3);
      db.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 } });
      db.review.count.mockResolvedValue(7);
    });

    it('не показывает баланс в чужой статистике', async () => {
      const stats = await service.getUserStats('user-1');

      expect(stats).not.toHaveProperty('balance');
      expect(stats).toMatchObject({ activeServices: 2, totalReviews: 7 });
    });

    it('показывает баланс в своей статистике', async () => {
      const stats = await service.getUserStats('user-1', true);

      expect(stats).toMatchObject({ balance: 5000 });
    });
  });

  describe('обновление профиля', () => {
    it('сохраняет переданные поля', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.user.update.mockResolvedValue({ id: 'user-1', name: 'Новое имя' });

      await service.update('user-1', { name: 'Новое имя' });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'Новое имя' }),
        }),
      );
    });

    it('не меняет группу на несуществующую', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.group.findUnique.mockResolvedValue(null);

      await expectBusinessError(
        () => service.updateGroup('user-1', 'missing-group'),
        { code: 'NOT_FOUND', status: 404 },
      );
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('меняет группу на существующую', async () => {
      db.user.findUnique.mockResolvedValue({ id: 'user-1' });
      db.group.findUnique.mockResolvedValue({ id: 'group-1' });
      db.user.update.mockResolvedValue({ id: 'user-1', groupId: 'group-1' });

      await service.updateGroup('user-1', 'group-1');

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { groupId: 'group-1' } }),
      );
    });
  });
});
