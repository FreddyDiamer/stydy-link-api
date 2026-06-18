import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DevLoginDto, AuthResponseDto } from './dto/auth.dto';
import { Public, ApiSuccessResponse } from '@common';

/**
 * Веб-авторизация для локальной разработки без Telegram.
 *
 * Все эндпоинты полностью отключены в production (см. AuthService.ensureDevEnvironment):
 * в production окружении вернётся 403 Forbidden.
 */
@ApiTags('Dev Authentication')
@Controller('auth/dev')
export class DevAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Веб-вход (только dev)',
    description:
      'Вход без Telegram: под существующим пользователем (userId) либо ' +
      'создание/получение тестового dev-пользователя. Отключено в production.',
  })
  @ApiSuccessResponse(AuthResponseDto)
  async devLogin(@Body() dto: DevLoginDto): Promise<AuthResponseDto> {
    return this.authService.devLogin(dto);
  }

  @Public()
  @Get('users')
  @ApiOperation({
    summary: 'Список пользователей для входа (только dev)',
    description:
      'Возвращает пользователей для выбора при веб-входе. Отключено в production.',
  })
  async listUsers() {
    return this.authService.listDevUsers();
  }
}
