import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DevOnlyGuard } from '@common';
import { DevAuthController } from './dev-auth.controller';

describe('DevAuthController', () => {
  // Гард стоит на классе, а не на методах: так новый dev-эндпоинт закрыт
  // в production без отдельного вызова проверки
  it('закрыт DevOnlyGuard целиком', () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, DevAuthController) ?? [];

    expect(guards).toContain(DevOnlyGuard);
  });
});
