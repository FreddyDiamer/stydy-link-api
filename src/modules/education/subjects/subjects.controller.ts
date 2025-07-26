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
import { SubjectsService } from './subjects.service';
import {
  CreateSubjectDto,
  UpdateSubjectDto,
  SubjectResponseDto,
  SubjectFilterDto,
} from './dto/subject.dto';
import { PaginationDto, ApiSuccessResponse } from '@common';

@ApiTags('Education - Subjects')
@Controller('education/subjects')
@ApiBearerAuth()
export class SubjectsController {
  constructor(private readonly subjectsService: SubjectsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать предмет',
    description: 'Добавление нового предмета в справочник университета',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async create(@Body() createSubjectDto: CreateSubjectDto) {
    return this.subjectsService.create(createSubjectDto);
  }

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

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить предмет',
    description: 'Обновить информацию о предмете университета',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
  ) {
    return this.subjectsService.update(id, updateSubjectDto);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Активировать предмет',
    description:
      'Сделать предмет доступным для выбора при создании услуг и заявок',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Деактивировать предмет',
    description:
      'Скрыть предмет из доступных для выбора (существующие услуги останутся)',
  })
  @ApiSuccessResponse(SubjectResponseDto)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.subjectsService.deactivate(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить предмет',
    description:
      'Полностью удалить предмет из справочника (только если не используется)',
  })
  @ApiSuccessResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subjectsService.remove(id);
    return {
      message: 'Предмет успешно удален из справочника',
      deletedAt: new Date(),
    };
  }
}
