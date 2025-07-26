import { Module } from '@nestjs/common';
import { TeacherSubjectsService } from './teacher-subjects.service';
import { TeacherSubjectsController } from './teacher-subjects.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TeacherSubjectsController],
  providers: [TeacherSubjectsService],
  exports: [TeacherSubjectsService],
})
export class TeacherSubjectsModule {}
