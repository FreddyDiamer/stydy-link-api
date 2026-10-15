import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ParserService } from './services/parser.service';
import { AdminGuard } from '@common';

/**
 * Запуск синхронизации справочников — только администраторы
 * (ADMIN_TELEGRAM_IDS): иначе любой пользователь мини-приложения мог бы
 * запустить 30-минутный воркер и переписать справочники.
 */
@ApiTags('Parser')
@UseGuards(AdminGuard)
@Controller('parser')
@ApiBearerAuth()
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Запустить синхронизацию (ожидая результат)',
    description:
      'Синхронизация справочников с университетским API (только администраторы); повторный запуск при уже идущей синхронизации вернёт 409',
  })
  async startSync() {
    return await this.parserService.parseAndSync();
  }

  @Post('async')
  @ApiOperation({
    summary: 'Запустить синхронизацию в фоне',
    description:
      'Запускает синхронизацию и сразу отвечает (только администраторы); повторный запуск при уже идущей синхронизации вернёт 409',
  })
  startAsync() {
    return this.parserService.startBackgroundSync();
  }
}
