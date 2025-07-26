import { Module } from '@nestjs/common';
import { RequestResponsesService } from './request-responses.service';
import { RequestResponsesController } from './request-responses.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RequestResponsesController],
  providers: [RequestResponsesService],
  exports: [RequestResponsesService],
})
export class RequestResponsesModule {}
