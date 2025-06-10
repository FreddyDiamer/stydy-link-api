import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { TelegramAuthDto, AuthResponseDto } from './dto/auth.dto';
import { Public, CurrentUser, ApiSuccessResponse } from '@common';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('telegram')
  @ApiOperation({
    summary: 'Авторизация через Telegram',
    description: 'Вход или регистрация пользователя через Telegram WebApp',
  })
  @ApiSuccessResponse(AuthResponseDto)
  async telegramAuth(
    @Body() authDto: TelegramAuthDto,
  ): Promise<AuthResponseDto> {
    return this.authService.loginOrRegister(authDto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Получить профиль',
    description: 'Получить информацию о текущем пользователе',
  })
  @ApiSuccessResponse(AuthResponseDto)
  async getProfile(@CurrentUser() user: User): Promise<AuthResponseDto> {
    const accessToken = await this.authService.generateAccessToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        telegramUsername: user.telegramUsername,
        name: user.name,
        isVerified: user.isVerified,
      },
    };
  }

  @Get('refresh')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Обновить токен',
    description: 'Генерирует новый JWT токен для текущего пользователя',
  })
  @ApiSuccessResponse(AuthResponseDto)
  async refreshToken(@CurrentUser() user: User): Promise<AuthResponseDto> {
    const accessToken = await this.authService.generateAccessToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        telegramUsername: user.telegramUsername,
        name: user.name,
        isVerified: user.isVerified,
      },
    };
  }
}
