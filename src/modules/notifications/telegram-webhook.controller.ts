import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Update } from 'telegraf/types';
import { Public, UnauthorizedException } from '@common';
import { TelegramBotService } from './telegram-bot.service';

/**
 * Приёмник апдейтов Telegram. Публичный (Telegram не шлёт JWT), но каждый
 * запрос обязан нести секрет вебхука — иначе любой мог бы прислать
 * поддельный апдейт от имени Telegram.
 */
@ApiTags('Telegram')
@Controller('telegram')
export class TelegramWebhookController {
  constructor(private readonly telegramBot: TelegramBotService) {}

  @Public()
  // Все апдейты идут с нескольких IP Telegram — общий лимит их бы душил
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Вебхук Telegram-бота',
    description:
      'Принимает апдейты от Telegram; требует заголовок X-Telegram-Bot-Api-Secret-Token',
  })
  async handle(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
  ) {
    if (!this.telegramBot.isWebhookSecretValid(secret)) {
      throw new UnauthorizedException('Неверный секрет вебхука');
    }
    await this.telegramBot.handleUpdate(update);
    return { ok: true };
  }
}
