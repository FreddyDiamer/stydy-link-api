import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { BusinessException, NotFoundException } from '@common';
import { TelegramAuthDto, AuthResponseDto } from './dto/auth.dto';
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
      // Ищем существующего пользователя
      let user = await this.db.user.findUnique({
        where: { telegramId: authDto.telegramId },
      });

      if (user) {
        // Обновляем данные если изменились
        if (
          user.telegramUsername !== authDto.telegramUsername ||
          user.name !== authDto.name
        ) {
          user = await this.db.user.update({
            where: { id: user.id },
            data: {
              telegramUsername: authDto.telegramUsername,
              name: authDto.name,
              lastActivity: new Date(),
            },
          });
        }
      } else {
        // Создаем нового пользователя
        user = await this.db.user.create({
          data: {
            telegramId: authDto.telegramId,
            telegramUsername: authDto.telegramUsername,
            name: authDto.name,
          },
        });
      }

      if (!user.isActive) {
        throw new BusinessException('User account is deactivated');
      }

      // Генерируем JWT токен
      const accessToken = await this.generateAccessToken(user);

      return {
        accessToken,
        user: {
          id: user.id,
          telegramUsername: user.telegramUsername,
          name: user.name,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      console.log('🚀 ~ AuthService ~ loginOrRegister ~ error:', error);

      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException('Authentication failed');
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

  private validateTelegramData(initData: string, botToken: string): boolean {
    const url = new URLSearchParams(initData);
    const hash = url.get('hash');
    url.delete('hash');

    const dataCheckString = Array.from(url.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }
}
