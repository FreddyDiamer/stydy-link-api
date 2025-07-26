import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherSubjectsService } from './teacher-subjects.service';
import {
  CreateTeacherSubjectDto,
  UpdateTeacherSubjectDto,
  TeacherSubjectResponseDto,
  TeacherSubjectFilterDto,
} from './dto/teacher-subject.dto';
import { PaginationDto, ApiSuccessResponse } from '@common';

@ApiTags('Education - Teacher Subjects')
@Controller('education/teacher-subjects')
@ApiBearerAuth()
export class TeacherSubjectsController {
  constructor(
    private readonly teacherSubjectsService: TeacherSubjectsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Создать связь преподавателя с предметом',
    description:
      'Создание связи между преподавателем и предметом в справочнике университета',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async create(@Body() createTeacherSubjectDto: CreateTeacherSubjectDto) {
    return this.teacherSubjectsService.create(createTeacherSubjectDto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Массовое создание связей',
    description: 'Массовое создание связей преподавателей с предметами',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async bulkCreate(@Body() relationships: CreateTeacherSubjectDto[]) {
    return this.teacherSubjectsService.bulkCreate(relationships);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список связей',
    description:
      'Получить список связей преподавателей с предметами с фильтрацией',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: TeacherSubjectFilterDto,
  ) {
    return this.teacherSubjectsService.findAll(paginationDto, filterDto);
  }

  @Get('teacher/:teacherId')
  @ApiOperation({
    summary: 'Получить предметы преподавателя',
    description: 'Получить активные предметы, которые ведет преподаватель',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить связь',
    description: 'Обновить связь преподавателя с предметом',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeacherSubjectDto: UpdateTeacherSubjectDto,
  ) {
    return this.teacherSubjectsService.update(id, updateTeacherSubjectDto);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Активировать связь',
    description: 'Активировать связь преподавателя с предметом',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherSubjectsService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Деактивировать связь',
    description: 'Деактивировать связь преподавателя с предметом',
  })
  @ApiSuccessResponse(TeacherSubjectResponseDto)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.teacherSubjectsService.deactivate(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить связь',
    description:
      'Полностью удалить связь преподавателя с предметом (только если не используется)',
  })
  @ApiSuccessResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.teacherSubjectsService.remove(id);
    return {
      message: 'Связь преподавателя с предметом успешно удалена',
      deletedAt: new Date(),
    };
  }
}
