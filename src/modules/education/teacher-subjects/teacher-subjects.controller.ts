import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherSubjectsService } from './teacher-subjects.service';
import {
  TeacherSubjectResponseDto,
  TeacherSubjectFilterDto,
  TeacherSubjectOfTeacherDto,
} from './dto/teacher-subject.dto';
import { ApiSuccessResponse } from '@common';

/**
 * Справочник связей преподаватель-предмет только для чтения: данные наполняет
 * парсер университетского API, ручное редактирование через публичный API закрыто.
 */
@ApiTags('Education - Teacher Subjects')
@Controller('education/teacher-subjects')
@ApiBearerAuth()
export class TeacherSubjectsController {
  constructor(
    private readonly teacherSubjectsService: TeacherSubjectsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список связей',
    description:
      'Получить список связей преподавателей с предметами с фильтрацией',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async findAll(@Query() query: TeacherSubjectFilterDto) {
    return this.teacherSubjectsService.findAll(query, query);
  }

  @Get('teacher/:teacherId')
  @ApiOperation({
    summary: 'Получить предметы преподавателя',
    description:
      'Все активные предметы преподавателя { id, subject: { id, name } } по названию предмета, без пагинации, в обёртке { items, total }',
  })
  @ApiSuccessResponse(TeacherSubjectOfTeacherDto)
  async findByTeacher(@Param('teacherId', ParseUUIDPipe) teacherId: string) {
    const subjects =
      await this.teacherSubjectsService.findActiveByTeacher(teacherId);
    return {
      items: subjects,
      total: subjects.length,
    };
  }

  @Get('subject/:subjectId')
  @ApiOperation({
    summary: 'Получить преподавателей предмета',
    description: 'Получить активных преподавателей, которые ведут предмет',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async findBySubject(@Param('subjectId', ParseUUIDPipe) subjectId: string) {
    const teachers =
      await this.teacherSubjectsService.findActiveBySubject(subjectId);
    return {
      items: teachers,
      total: teachers.length,
    };
  }

  @Get('stats/:teacherId/:subjectId')
  @ApiOperation({
    summary: 'Статистика связи преподавателя с предметом',
    description:
      'Получить статистику активности связи преподавателя с предметом',
  })
  @ApiSuccessResponse()
  async getStats(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
  ) {
    return this.teacherSubjectsService.getTeacherSubjectStats(
      teacherId,
      subjectId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить связь по ID',
    description:
      'Получить подробную информацию о связи преподавателя с предметом',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherSubjectsService.findOne(id);
  }
}
