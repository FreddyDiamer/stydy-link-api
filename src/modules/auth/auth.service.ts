import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { BusinessException, NotFoundException } from '@common';
import {
  TelegramAuthDto,
  AuthResponseDto,
  TelegramInitData,
  DevLoginDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async loginOrRegister(authDto: TelegramAuthDto): Promise<AuthResponseDto> {
    try {
      // Валидируем initData строку
      const botToken = this.configService.get<string>('app.telegramBotToken');
      if (
        botToken &&
        !this.validateTelegramInitData(authDto.initData, botToken)
      ) {
        throw new BusinessException('Invalid Telegram authentication data');
      }

      // Парсим данные из initData
      const telegramData = this.parseInitData(authDto.initData);
      const telegramUser = telegramData.user;

      // Формируем данные пользователя
      const telegramId = telegramUser.id.toString();
      const telegramUsername = telegramUser.username || '';
      const name = `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`;

      // Ищем существующего пользователя
      let user = await this.db.user.findUnique({
        where: { telegramId },
        include: {
          group: true,
        },
      });

      if (user) {
        // Обновляем данные если изменились
        if (user.telegramUsername !== telegramUsername || user.name !== name) {
          user = await this.db.user.update({
            where: { id: user.id },
            data: {
              telegramUsername,
              name,
              lastActivity: new Date(),
            },
            include: {
              group: true,
            },
          });
        }
      } else {
        // Создаем нового пользователя
        user = await this.db.user.create({
          data: {
            telegramId,
            telegramUsername,
            name,
          },
          include: {
            group: true,
          },
        });
      }

      // Генерируем JWT токен
      const accessToken = await this.generateAccessToken(user);

      return {
        accessToken,
        user,
      };
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException('Authentication failed');
    }
  }

  /**
   * Веб-авторизация для разработки без Telegram.
   * Полностью отключена в production — позволяет войти под существующим
   * пользователем или создать/получить тестового dev-пользователя.
   */
  async devLogin(dto: DevLoginDto): Promise<AuthResponseDto> {
    this.ensureDevEnvironment();

    let user: User | null = null;

    if (dto.userId) {
      // Вход под конкретным существующим пользователем
      user = await this.db.user.findUnique({
        where: { id: dto.userId },
        include: { group: true },
      });

      if (!user) {
        throw new NotFoundException('User', dto.userId);
      }
    } else {
      // Создаём/находим тестового пользователя по telegramId
      const telegramId = dto.telegramId ?? 'dev-user';
      const telegramUsername = dto.telegramUsername ?? 'dev_user';
      const name = dto.name ?? 'Dev User';

      user = await this.db.user.upsert({
        where: { telegramId },
        update: { lastActivity: new Date() },
        create: { telegramId, telegramUsername, name },
        include: { group: true },
      });
    }

    const accessToken = await this.generateAccessToken(user);

    return { accessToken, user };
  }

  /**
   * Список пользователей для выбора при веб-входе в режиме разработки.
   * Полностью отключён в production.
   */
  async listDevUsers(): Promise<
    Pick<User, 'id' | 'telegramId' | 'telegramUsername' | 'name'>[]
  > {
    this.ensureDevEnvironment();

    return this.db.user.findMany({
      select: {
        id: true,
        telegramId: true,
        telegramUsername: true,
        name: true,
      },
      orderBy: { lastActivity: 'desc' },
      take: 100,
    });
  }

  private ensureDevEnvironment(): void {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    if (nodeEnv === 'production') {
      throw new ForbiddenException(
        'Web auth is disabled in production environment',
      );
    }
  }

  private parseInitData(initData: string): TelegramInitData {
    try {
      const params = new URLSearchParams(initData);
      const result: any = {};

      for (const [key, value] of params.entries()) {
        if (key === 'user' || key === 'receiver' || key === 'chat') {
          result[key] = JSON.parse(decodeURIComponent(value));
        } else if (key === 'auth_date' || key === 'can_send_after') {
          result[key] = parseInt(value, 10);
        } else {
          result[key] = value;
        }
      }

      return result as TelegramInitData;
    } catch (error) {
      throw new BusinessException('Failed to parse Telegram init data');
    }
  }

  private validateTelegramInitData(
    initData: string,
    botToken: string,
  ): boolean {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');

      if (!hash) {
        return false;
      }

      params.delete('hash');

      // Создаем строку для проверки
      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Генерируем секретный ключ
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Вычисляем hash
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch (error) {
      return false;
    }
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User', id);
    }

    return user;
  }

  async validateUser(telegramId: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { telegramId },
    });
  }

  async generateAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });
  }
}
