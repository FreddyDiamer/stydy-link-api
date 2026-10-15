import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DevLoginDto, AuthResponseDto } from './dto/auth.dto';
import { Public, ApiSuccessResponse, DevOnlyGuard } from '@common';

/**
 * Веб-авторизация для локальной разработки без Telegram.
 *
 * DevOnlyGuard на классе закрывает каждый метод вне NODE_ENV=development (403),
 * включая будущие; AuthService.ensureDevEnvironment — второй рубеж.
 */
@ApiTags('Dev Authentication')
@UseGuards(DevOnlyGuard)
@Controller('auth/dev')
export class DevAuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Веб-вход (только dev)',
    description:
      'Вход без Telegram: под существующим пользователем (userId или ' +
      'telegramUsername) либо создание/получение тестового dev-пользователя. ' +
      'Отключено в production.',
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
