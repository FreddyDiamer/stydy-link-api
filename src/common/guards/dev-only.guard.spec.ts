import { ConfigService } from '@nestjs/config';
import { DevOnlyGuard } from './dev-only.guard';
import { expectBusinessError } from '../../test-support/mocks';

const guardFor = (nodeEnv: string | undefined) =>
  new DevOnlyGuard({
    get: () => nodeEnv,
  } as unknown as ConfigService);

describe('DevOnlyGuard', () => {
  it('пропускает в development', () => {
    expect(guardFor('development').canActivate()).toBe(true);
  });

  it.each(['production', 'test', undefined])(
    'отвечает 403 при NODE_ENV=%s',
    async (nodeEnv) => {
      await expectBusinessError(
        () => Promise.resolve().then(() => guardFor(nodeEnv).canActivate()),
        { code: 'FORBIDDEN', status: 403 },
      );
    },
  );
});
