import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { BaseService } from '../../common';

export interface InlineKeyboardButton {
  text: string;
  url: string;
}

@Injectable()
export class TelegramBotService extends BaseService {
  private bot: Telegraf | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    const token = this.configService.get<string>('app.telegramBotToken');
    if (token) {
      this.bot = new Telegraf(token);
    }
  }

  /**
   * Send a text message to a user in private chat with optional inline buttons.
   * Does nothing if bot token is not configured. Logs and swallows errors (e.g. user blocked bot).
   */
  async sendMessage(
    telegramId: string,
    text: string,
    options?: { inlineKeyboard?: InlineKeyboardButton[][] },
  ): Promise<void> {
    if (!this.bot) {
      this.logWarn('Telegram bot token not set, skip sending message');
      return;
    }

    const reply_markup =
      options?.inlineKeyboard?.length &&
      options.inlineKeyboard.some((row) => row.length > 0)
        ? {
            inline_keyboard: options.inlineKeyboard.map((row) =>
              row.map((btn) => ({ text: btn.text, url: btn.url })),
            ),
          }
        : undefined;

    try {
      await this.bot.telegram.sendMessage(telegramId, text, {
        parse_mode: 'HTML',
        reply_markup,
      });
    } catch (error) {
      this.logError(
        'Failed to send Telegram message',
        error instanceof Error ? error : new Error(String(error)),
        { telegramId, textLength: text.length },
      );
    }
  }
}
