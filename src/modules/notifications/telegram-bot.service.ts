import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Telegraf } from 'telegraf';
import type {
  InlineKeyboardButton as TelegramButton,
  InlineKeyboardMarkup,
  Update,
} from 'telegraf/types';
import { BaseService } from '../../common';

export interface InlineKeyboardButton {
  text: string;
  url: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const startText = (firstName?: string): string =>
  [
    `Привет${firstName ? `, ${escapeHtml(firstName)}` : ''}! 👋`,
    'Это Study Link — тут студенты КАИ помогают друг другу с учёбой.',
    '',
    '📚 Завис на лабе или курсаче? Оставь заявку — репетиторы откликнутся сами.',
    '🎓 Шаришь в предмете? Выложи услугу и помогай.',
    '',
    'Жми кнопку ниже — и погнали 🚀',
    'А я напишу сюда, когда появятся отклики и сделки 🔔',
  ].join('\n');

const HINT_TEXT =
  'Я пока не умею болтать 🙈 Всё самое интересное — в приложении 👇';

/** Путь вебхука: глобальный префикс /api + TelegramWebhookController */
export const TELEGRAM_WEBHOOK_PATH = '/api/telegram/webhook';

/**
 * Telegram-бот: уведомления, ответ на /start и приём апдейтов через вебхук.
 *
 * Апдейты приходят на POST /api/telegram/webhook (TelegramWebhookController).
 * Вебхук регистрируется при старте, если задан TELEGRAM_WEBHOOK_SECRET, по
 * адресу FRONTEND_BASE_URL + TELEGRAM_WEBHOOK_PATH — фронтенд и API живут на
 * одном домене (Caddy отдаёт /api/* приложению).
 */
@Injectable()
export class TelegramBotService
  extends BaseService
  implements OnApplicationBootstrap
{
  private bot: Telegraf | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    const token = this.configService.get<string>('app.telegramBotToken');
    if (token) {
      this.bot = new Telegraf(token);
      this.registerHandlers(this.bot);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    const baseUrl = this.configService.get<string>('app.frontendBaseUrl');
    const secret = this.configService.get<string>('app.telegramWebhookSecret');
    if (!this.bot || !baseUrl || !secret) return;
    const url = `${baseUrl.replace(/\/$/, '')}${TELEGRAM_WEBHOOK_PATH}`;

    try {
      await this.bot.telegram.setWebhook(url, {
        secret_token: secret,
        allowed_updates: ['message'],
      });
      this.logInfo('Telegram webhook registered', { url });
    } catch (error) {
      // Без вебхука бот не отвечает на /start, но уведомления работают —
      // не роняем из-за этого запуск приложения
      this.logError(
        'Failed to register Telegram webhook',
        error instanceof Error ? error : new Error(String(error)),
        { url },
      );
    }
  }

  /** Сверяет заголовок X-Telegram-Bot-Api-Secret-Token с секретом вебхука. */
  isWebhookSecretValid(received: string | undefined): boolean {
    const expected = this.configService.get<string>(
      'app.telegramWebhookSecret',
    );
    if (!expected || !received) return false;
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async handleUpdate(update: Update): Promise<void> {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
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
              row.map((btn) => this.toTelegramButton(btn)),
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

  private registerHandlers(bot: Telegraf): void {
    bot.start((ctx) =>
      ctx.reply(startText(ctx.from?.first_name), {
        parse_mode: 'HTML',
        reply_markup: this.openAppMarkup(),
      }),
    );
    bot.on('message', (ctx) =>
      ctx.reply(HINT_TEXT, { reply_markup: this.openAppMarkup() }),
    );
    bot.catch((error) => {
      this.logError(
        'Failed to handle Telegram update',
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  }

  private openAppMarkup(): InlineKeyboardMarkup | undefined {
    const url = this.configService.get<string>('app.frontendBaseUrl');
    if (!url) return undefined;
    return {
      inline_keyboard: [
        [this.toTelegramButton({ text: '🚀 Открыть Study Link', url })],
      ],
    };
  }

  /**
   * Ссылка на мини-приложение открывается внутри Telegram (web_app), чтобы
   * пользователь попал в приложение уже авторизованным; обычная url-кнопка
   * открывает внешний браузер, где входа через Telegram нет. Telegram
   * принимает web_app только с HTTPS, поэтому FRONTEND_BASE_URL — https.
   */
  private toTelegramButton(btn: InlineKeyboardButton): TelegramButton {
    return { text: btn.text, web_app: { url: btn.url } };
  }
}
