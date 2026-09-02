import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeachersService } from './teachers.service';
import { TeacherResponseDto, TeacherFilterDto } from './dto/teacher.dto';
import { PaginationDto, ApiSuccessResponse } from '@common';

/**
 * Справочник преподавателей только для чтения: данные наполняет парсер
 * университетского API, ручное редактирование через публичный API закрыто.
 */
@ApiTags('Education - Teachers')
@Controller('education/teachers')
@ApiBearerAuth()
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

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
}
