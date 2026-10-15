import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { DatabaseService } from '../../database/database.service';
import {
  createDatabaseMock,
  expectBusinessError,
  DatabaseMock,
} from '../../test-support/mocks';

const BOT_TOKEN = 'test-bot-token';

/** Собирает initData с корректной подписью — как её присылает Telegram WebApp */
function buildInitData(
  overrides: {
    authDate?: number;
    user?: Record<string, unknown>;
    botToken?: string;
    hash?: string;
  } = {},
): string {
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const user = overrides.user ?? {
    id: 852915881,
    first_name: 'Иван',
    last_name: 'Иванов',
    username: 'ivan',
  };

  // Значения в dataCheckString — декодированные, как их отдаёт URLSearchParams
  const fields: Record<string, string> = {
    auth_date: String(authDate),
    query_id: 'AAGpdtYyAAAAAKl21jLf3CLz',
    user: JSON.stringify(user),
  };

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(overrides.botToken ?? BOT_TOKEN)
    .digest();
  const hash =
    overrides.hash ??
    crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

describe('AuthService', () => {
  let service: AuthService;
  let db: DatabaseMock;
  let config: { get: jest.Mock };

  const configValues = (nodeEnv: string, botToken?: string) => ({
    'app.nodeEnv': nodeEnv,
    'app.telegramBotToken': botToken,
    'jwt.secret': 'a'.repeat(32),
    'jwt.expiresIn': '7d',
  });

  const setEnv = (nodeEnv: string, botToken?: string) => {
    const values: Record<string, unknown> = configValues(nodeEnv, botToken);
    config.get.mockImplementation((key: string) => values[key]);
  };

  beforeEach(async () => {
    db = createDatabaseMock();
    config = { get: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: db },
        { provide: ConfigService, useValue: config },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('signed.jwt') },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    setEnv('production', BOT_TOKEN);
  });

  describe('вход через Telegram', () => {
    it('создаёт пользователя при корректной подписи', async () => {
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'user-1', ...data }),
      );

      const result = await service.loginOrRegister({
        initData: buildInitData(),
      });

      expect(result.accessToken).toBe('signed.jwt');
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            telegramId: '852915881',
            telegramUsername: 'ivan',
            name: 'Иван Иванов',
          }),
        }),
      );
    });

    it('обновляет имя и username существующего пользователя', async () => {
      db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        telegramId: '852915881',
        telegramUsername: 'old_name',
        name: 'Старое Имя',
      });
      db.user.update.mockResolvedValue({ id: 'user-1' });

      await service.loginOrRegister({ initData: buildInitData() });

      expect(db.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            telegramUsername: 'ivan',
            name: 'Иван Иванов',
          }),
        }),
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('отклоняет подделанную подпись', async () => {
      await expectBusinessError(
        () =>
          service.loginOrRegister({
            initData: buildInitData({ hash: 'deadbeef'.repeat(8) }),
          }),
        { status: 400 },
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('отклоняет подпись, сделанную чужим токеном бота', async () => {
      await expectBusinessError(
        () =>
          service.loginOrRegister({
            initData: buildInitData({ botToken: 'another-bot-token' }),
          }),
        { status: 400 },
      );
    });

    it('отклоняет просроченный initData (защита от replay)', async () => {
      const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;

      await expectBusinessError(
        () =>
          service.loginOrRegister({
            initData: buildInitData({ authDate: twoDaysAgo }),
          }),
        { status: 400 },
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('принимает свежий initData на границе допустимого возраста', async () => {
      const almostExpired = Math.floor(Date.now() / 1000) - 23 * 60 * 60;
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.loginOrRegister({
          initData: buildInitData({ authDate: almostExpired }),
        }),
      ).resolves.toMatchObject({ accessToken: 'signed.jwt' });
    });

    it('отклоняет initData из будущего', async () => {
      const farFuture = Math.floor(Date.now() / 1000) + 60 * 60;

      await expectBusinessError(
        () =>
          service.loginOrRegister({
            initData: buildInitData({ authDate: farFuture }),
          }),
        { status: 400 },
      );
    });

    it('отказывает во входе, если токен бота не настроен (fail closed)', async () => {
      setEnv('production', undefined);

      await expectBusinessError(
        () => service.loginOrRegister({ initData: buildInitData() }),
        { status: 400 },
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it('пропускает мок-данные только в development', async () => {
      setEnv('development', BOT_TOKEN);
      db.user.findUnique.mockResolvedValue(null);
      db.user.create.mockResolvedValue({ id: 'dev-user' });

      const mockInitData = `user=${encodeURIComponent(
        JSON.stringify({ id: 1, first_name: 'Dev' }),
      )}&auth_date=1&hash=mock`;

      await expect(
        service.loginOrRegister({ initData: mockInitData }),
      ).resolves.toMatchObject({ accessToken: 'signed.jwt' });
    });

    it('не принимает мок-данные вне development', async () => {
      const mockInitData = `user=${encodeURIComponent(
        JSON.stringify({ id: 1, first_name: 'Dev' }),
      )}&auth_date=1&hash=mock`;

      await expectBusinessError(
        () => service.loginOrRegister({ initData: mockInitData }),
        { status: 400 },
      );
      expect(db.user.create).not.toHaveBeenCalled();
    });
  });

  describe('dev-вход', () => {
    it('работает в development', async () => {
      setEnv('development', BOT_TOKEN);
      db.user.upsert.mockResolvedValue({ id: 'dev-user' });

      await expect(service.devLogin({})).resolves.toMatchObject({
        accessToken: 'signed.jwt',
      });
    });

    it('входит по username существующего пользователя без учёта регистра и @', async () => {
      setEnv('development', BOT_TOKEN);
      db.user.findFirst.mockResolvedValue({ id: 'anna' });

      await expect(
        service.devLogin({ telegramUsername: '@Anna_Math' }),
      ).resolves.toMatchObject({ user: { id: 'anna' } });
      expect(db.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            telegramUsername: { equals: 'Anna_Math', mode: 'insensitive' },
          },
        }),
      );
      expect(db.user.upsert).not.toHaveBeenCalled();
    });

    it('по неизвестному username отвечает 404 и никого не создаёт', async () => {
      setEnv('development', BOT_TOKEN);
      db.user.findFirst.mockResolvedValue(null);

      await expectBusinessError(
        () => service.devLogin({ telegramUsername: 'nobody' }),
        { code: 'NOT_FOUND', status: 404 },
      );
      expect(db.user.upsert).not.toHaveBeenCalled();
    });

    it('с telegramId по-прежнему создаёт пользователя, username идёт в профиль', async () => {
      setEnv('development', BOT_TOKEN);
      db.user.upsert.mockResolvedValue({ id: 'new' });

      await service.devLogin({ telegramId: '42', telegramUsername: 'new_one' });

      expect(db.user.findFirst).not.toHaveBeenCalled();
      expect(db.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: '42' },
          create: expect.objectContaining({ telegramUsername: 'new_one' }),
        }),
      );
    });

    it('запрещён в production', async () => {
      await expectBusinessError(() => service.devLogin({}), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });

    it('запрещён, когда окружение не задано', async () => {
      setEnv(undefined as unknown as string, BOT_TOKEN);

      await expectBusinessError(() => service.devLogin({}), {
        code: 'FORBIDDEN',
        status: 403,
      });
    });

    it('не выдаёт список пользователей вне development', async () => {
      await expectBusinessError(() => service.listDevUsers(), {
        code: 'FORBIDDEN',
        status: 403,
      });
      expect(db.user.findMany).not.toHaveBeenCalled();
    });
  });
});
