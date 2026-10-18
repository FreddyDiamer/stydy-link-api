import { ConfigService } from '@nestjs/config';
import type { Update } from 'telegraf/types';
import { Telegram } from 'telegraf';
import { TelegramBotService } from './telegram-bot.service';

const BASE_URL = 'https://study-link.site';
const SECRET = 'webhook-secret-0123456789';

const createService = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    'app.telegramBotToken': '123:TEST',
    'app.frontendBaseUrl': BASE_URL,
    'app.telegramWebhookSecret': SECRET,
    ...overrides,
  };
  const service = new TelegramBotService({
    get: (key: string) => values[key],
  } as unknown as ConfigService);
  const bot = (service as any).bot;
  // botInfo задан заранее, чтобы Telegraf не ходил за getMe
  if (bot) {
    bot.botInfo = {
      id: 1,
      is_bot: true,
      first_name: 'Study Link',
      username: 'study_link_bot',
    };
  }
  // Telegraf создаёт свой клиент Telegram на каждый апдейт, поэтому
  // перехватываем вызовы API на прототипе, а не на bot.telegram
  const callApi = jest
    .spyOn(Telegram.prototype, 'callApi')
    .mockResolvedValue({} as never);
  return { service, callApi };
};

const messageUpdate = (text: string, firstName = 'Аня'): Update =>
  ({
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 42, type: 'private', first_name: firstName },
      from: { id: 42, is_bot: false, first_name: firstName },
      text,
      ...(text.startsWith('/')
        ? {
            entities: [{ type: 'bot_command', offset: 0, length: text.length }],
          }
        : {}),
    },
  }) as unknown as Update;

const sentPayload = (callApi: jest.SpyInstance, method = 'sendMessage') =>
  callApi.mock.calls.find((c) => c[0] === method)?.[1];

describe('TelegramBotService', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('кнопки уведомлений', () => {
    it('ссылку открывает как мини-приложение (web_app)', async () => {
      const { service, callApi } = createService();

      await service.sendMessage('42', 'Новый отклик', {
        inlineKeyboard: [[{ text: 'Открыть', url: `${BASE_URL}/deals` }]],
      });

      expect(sentPayload(callApi).reply_markup.inline_keyboard).toEqual([
        [{ text: 'Открыть', web_app: { url: `${BASE_URL}/deals` } }],
      ]);
    });
  });

  describe('ответы бота', () => {
    it('на /start здоровается по имени и даёт кнопку открыть приложение', async () => {
      const { service, callApi } = createService();

      await service.handleUpdate(messageUpdate('/start'));

      const payload = sentPayload(callApi);
      expect(payload.chat_id).toBe(42);
      expect(payload.text).toContain('Привет, Аня!');
      expect(payload.reply_markup.inline_keyboard).toEqual([
        [{ text: '🚀 Открыть Study Link', web_app: { url: BASE_URL } }],
      ]);
    });

    it('экранирует имя — HTML в имени не ломает сообщение', async () => {
      const { service, callApi } = createService();

      await service.handleUpdate(messageUpdate('/start', '<b>Хакер</b>'));

      expect(sentPayload(callApi).text).toContain('&lt;b&gt;Хакер&lt;/b&gt;');
    });

    it('на любое другое сообщение отвечает подсказкой с кнопкой', async () => {
      const { service, callApi } = createService();

      await service.handleUpdate(messageUpdate('привет'));

      const payload = sentPayload(callApi);
      expect(payload.text).toContain('в приложении');
      expect(payload.reply_markup.inline_keyboard[0][0].web_app.url).toBe(
        BASE_URL,
      );
    });
  });

  describe('вебхук', () => {
    it('принимает только верный секрет', () => {
      const { service } = createService();

      expect(service.isWebhookSecretValid(SECRET)).toBe(true);
      expect(service.isWebhookSecretValid('wrong-secret-0123456789')).toBe(
        false,
      );
      expect(service.isWebhookSecretValid(undefined)).toBe(false);
    });

    it('без настроенного секрета не пускает никого', () => {
      const { service } = createService({
        'app.telegramWebhookSecret': undefined,
      });

      expect(service.isWebhookSecretValid('')).toBe(false);
      expect(service.isWebhookSecretValid(SECRET)).toBe(false);
    });

    it('регистрирует вебхук на домене приложения, когда задан секрет', async () => {
      const { service, callApi } = createService();

      await service.onApplicationBootstrap();

      expect(sentPayload(callApi, 'setWebhook')).toMatchObject({
        url: `${BASE_URL}/api/telegram/webhook`,
        secret_token: SECRET,
      });
    });

    it('без секрета вебхук не регистрирует — открытый вебхук недопустим', async () => {
      const { service, callApi } = createService({
        'app.telegramWebhookSecret': undefined,
      });

      await service.onApplicationBootstrap();

      expect(sentPayload(callApi, 'setWebhook')).toBeUndefined();
    });
  });
});
