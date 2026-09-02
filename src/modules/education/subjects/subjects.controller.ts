import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubjectsService } from './subjects.service';
import { SubjectResponseDto, SubjectFilterDto } from './dto/subject.dto';
import { PaginationDto, ApiSuccessResponse } from '@common';

/**
 * Справочник предметов только для чтения: данные наполняет парсер
 * университетского API, ручное редактирование через публичный API закрыто.
 */
@ApiTags('Education - Subjects')
@Controller('education/subjects')
@ApiBearerAuth()
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список предметов',
    description:
      'Получить список предметов университета с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: SubjectFilterDto,
  ) {
    return this.subjectsService.findAll(paginationDto, filterDto);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Получить активные предметы',
    description: 'Получить список активных предметов для выбора в формах',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async findActive() {
    const subjects = await this.subjectsService.findActive();
    return {
      items: subjects,
      total: subjects.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить предмет по ID',
    description:
      'Получить подробную информацию о предмете с преподавателями и статистикой',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику предмета',
    description:
      'Получить детальную статистику использования предмета в системе',
  })
  @ApiSuccessResponse()
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.getSubjectStats(id);
  }
}
