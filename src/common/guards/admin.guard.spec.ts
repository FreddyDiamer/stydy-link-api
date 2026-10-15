import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { AdminGuard } from './admin.guard';
import { expectBusinessError } from '../../test-support/mocks';

const guardWith = (adminIds: string[] | undefined) =>
  new AdminGuard({ get: () => adminIds } as unknown as ConfigService);

const contextFor = (user?: Partial<User>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const run = (guard: AdminGuard, user?: Partial<User>) =>
  Promise.resolve().then(() => guard.canActivate(contextFor(user)));

describe('AdminGuard', () => {
  it('пропускает пользователя из ADMIN_TELEGRAM_IDS', () => {
    expect(
      guardWith(['111', '222']).canActivate(contextFor({ telegramId: '222' })),
    ).toBe(true);
  });

  it('не пускает остальных — 403', async () => {
    await expectBusinessError(
      () => run(guardWith(['111']), { telegramId: '999' }),
      { code: 'FORBIDDEN', status: 403 },
    );
  });

  it('пустой список закрывает доступ всем', async () => {
    await expectBusinessError(() => run(guardWith([]), { telegramId: '111' }), {
      code: 'FORBIDDEN',
      status: 403,
    });
    await expectBusinessError(
      () => run(guardWith(undefined), { telegramId: '111' }),
      { code: 'FORBIDDEN', status: 403 },
    );
  });
});
