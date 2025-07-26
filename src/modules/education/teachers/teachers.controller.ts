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
import { TeachersService } from './teachers.service';
import {
  CreateTeacherDto,
  UpdateTeacherDto,
  TeacherResponseDto,
  TeacherFilterDto,
} from './dto/teacher.dto';
import { PaginationDto, ApiSuccessResponse } from '@common';

@ApiTags('Education - Teachers')
@Controller('education/teachers')
@ApiBearerAuth()
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать преподавателя',
    description: 'Добавление нового преподавателя в справочник университета',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async create(@Body() createTeacherDto: CreateTeacherDto) {
    return this.teachersService.create(createTeacherDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список преподавателей',
    description:
      'Получить список преподавателей университета с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: TeacherFilterDto,
  ) {
    return this.teachersService.findAll(paginationDto, filterDto);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Получить активных преподавателей',
    description:
      'Получить список преподавателей, которые ведут активные предметы',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async findActive() {
    const teachers = await this.teachersService.findActiveTeachers();
    return {
      items: teachers,
      total: teachers.length,
    };
  }

  @Get('by-subject/:subjectId')
  @ApiOperation({
    summary: 'Получить преподавателей по предмету',
    description: 'Получить список преподавателей, ведущих определенный предмет',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async findBySubject(@Param('subjectId', ParseUUIDPipe) subjectId: string) {
    const teachers = await this.teachersService.getTeachersBySubject(subjectId);
    return {
      items: teachers,
      total: teachers.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить преподавателя по ID',
    description:
      'Получить подробную информацию о преподавателе с предметами и статистикой',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику преподавателя',
    description:
      'Получить детальную статистику активности преподавателя в системе',
  })
  @ApiSuccessResponse()
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.getTeacherStats(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить преподавателя',
    description: 'Обновить информацию о преподавателе университета',
  })
  @ApiSuccessResponse(TeacherResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeacherDto: UpdateTeacherDto,
  ) {
    return this.teachersService.update(id, updateTeacherDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить преподавателя',
    description:
      'Полностью удалить преподавателя из справочника (только если не используется)',
  })
  @ApiSuccessResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.teachersService.remove(id);
    return {
      message: 'Преподаватель успешно удален из справочника',
      deletedAt: new Date(),
    };
  }
}
