import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '../exceptions/business.exception';

/**
 * Пропускает запрос только при явном NODE_ENV=development.
 *
 * Вешается на весь контроллер, чтобы любой новый метод dev-инструментов был
 * закрыт автоматически, а не держался на вызове проверки внутри сервиса.
 * Любое другое окружение (production, test, не заданное) получает 403.
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    if (nodeEnv !== 'development') {
      throw new ForbiddenException('Доступно только в development-окружении');
    }
    return true;
  }
}
