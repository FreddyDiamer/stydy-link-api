import { Module } from '@nestjs/common';
import { ServiceResponsesService } from './service-responses.service';
import { ServiceResponsesController } from './service-responses.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceResponsesController],
  providers: [ServiceResponsesService],
  exports: [ServiceResponsesService],
})
export class ServiceResponsesModule {}
