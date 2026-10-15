import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { ForbiddenException } from '../exceptions/business.exception';

/**
 * Пропускает только пользователей, чей Telegram ID указан в ADMIN_TELEGRAM_IDS.
 *
 * Ролей в схеме нет, поэтому администраторы задаются окружением. Пустой
 * список закрывает доступ всем: забытая переменная не должна открывать
 * админские операции каждому вошедшему. Работает после глобального
 * JwtAuthGuard, который кладёт пользователя в request.user.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const adminIds =
      this.configService.get<string[]>('app.adminTelegramIds') ?? [];
    const telegramId = request.user?.telegramId;
    if (!telegramId || !adminIds.includes(telegramId)) {
      throw new ForbiddenException('Доступно только администраторам');
    }
    return true;
  }
}
