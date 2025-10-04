import { Controller, Post } from '@nestjs/common';
import { ParserService } from './services/parser.service';
import { Public } from '@common';

@Controller('parser')
export class ParserController {
  constructor(private readonly parserService: ParserService) {}
  @Public()
  @Post('sync')
  async startSync() {
    return await this.parserService.parseAndSync();
  }
  @Public()
  @Post('async')
  startAsync() {
    void this.parserService.parseAndSync();
    return { message: 'Parsing started' };
  }
}
