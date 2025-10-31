import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ParserController } from './parser.controller';
import { ParserService } from './services/parser.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ParserController],
  providers: [ParserService],
})
export class ParserModule {}
