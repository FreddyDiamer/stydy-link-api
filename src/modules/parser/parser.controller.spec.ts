import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from '@common';
import { ParserController } from './parser.controller';

describe('ParserController', () => {
  // Запуск парсера переписывает справочники: закрыт для всех, кроме админов
  it('закрыт AdminGuard целиком', () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, ParserController) ?? [];

    expect(guards).toContain(AdminGuard);
  });
});
