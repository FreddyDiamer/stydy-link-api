import { Controller, Post } from '@nestjs/common';
import { ParserService } from './services/parser.service';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}

  @Post('sync')
  async startSync() {
    return await this.parserService.parseAndSync();
  }

  @Post('async')
  startAsync() {
    void this.parserService.parseAndSync();
    return { message: 'Parsing started' };
  }
}
