import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { User } from '@prisma/client';
import { UnauthorizedException } from '@common';
import { DatabaseService } from '@database/database.service';

export interface JwtPayload {
  sub: string; // user id
  telegramId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly db: DatabaseService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('jwt.secret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Inactive user');
    }

    // Обновляем последнюю активность
    await this.db.user.update({
      where: { id: user.id },
      data: { lastActivity: new Date() },
    });

    return user;
  }
}
