import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ParserService } from './services/parser.service';

/**
 * Запуск синхронизации справочников. Требует авторизации:
 * публичный доступ позволял любому анониму запускать 30-минутный
 * воркер и переписывать справочники.
 */
@ApiTags('Parser')
@Controller('parser')
@ApiBearerAuth()
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('sync')
  @ApiOperation({
    summary: 'Запустить синхронизацию (ожидая результат)',
    description:
      'Синхронизация справочников с университетским API; повторный запуск при уже идущей синхронизации вернёт 409',
  })
  async startSync() {
    return await this.parserService.parseAndSync();
  }

  @Post('async')
  @ApiOperation({
    summary: 'Запустить синхронизацию в фоне',
    description:
      'Запускает синхронизацию и сразу отвечает; повторный запуск при уже идущей синхронизации вернёт 409',
  })
  startAsync() {
    return this.parserService.startBackgroundSync();
  }
}
