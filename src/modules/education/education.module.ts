import { Module } from '@nestjs/common';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { TeacherSubjectsModule } from './teacher-subjects/teacher-subjects.module';

/**
 * Домен Education - справочники университета
 *
 * Содержит все сущности, связанные с образовательными данными университета:
 * - Subject: предметы, преподаваемые в университете
 * - Teacher: преподаватели университета
 * - TeacherSubject: связи между преподавателями и предметами
 *
 * Эти данные используются как справочники для создания услуг и заявок
 * в домене Marketplace.
 */
@Module({
  imports: [SubjectsModule, TeachersModule, TeacherSubjectsModule],
  exports: [SubjectsModule, TeachersModule, TeacherSubjectsModule],
})
export class EducationModule {}
