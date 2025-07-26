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
import { ServicesService } from './services.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceResponseDto,
  ServiceFilterDto,
} from './dto/service.dto';
import {
  PaginationDto,
  ApiSuccessResponse,
  CurrentUser,
  BusinessException,
} from '@common';
import { User } from '@prisma/client';

@ApiTags('Marketplace - Services')
@Controller('marketplace/services')
@ApiBearerAuth()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать услугу',
    description: 'Создание новой услуги репетитора для торговой площадки',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем, что пользователь создает услугу для себя
    if (createServiceDto.tutorId !== user.id) {
      throw new BusinessException(
        'Нельзя создавать услуги от имени других пользователей',
      );
    }
    return this.servicesService.create(createServiceDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список услуг',
    description: 'Получить список услуг репетиторов с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ServiceFilterDto,
  ) {
    return this.servicesService.findAll(paginationDto, filterDto);
  }

  @Get('active')
  @ApiOperation({
    summary: 'Получить активные услуги',
    description: 'Получить список активных услуг для студентов',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findActive() {
    const services = await this.servicesService.findActiveServices();
    return {
      items: services,
      total: services.length,
    };
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Получить популярные услуги',
    description:
      'Получить список самых популярных услуг по количеству откликов',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findPopular(@Query('limit') limit?: number) {
    const services = await this.servicesService.getPopularServices(limit);
    return {
      items: services,
      total: services.length,
    };
  }

  @Get('my')
  @ApiOperation({
    summary: 'Получить мои услуги',
    description: 'Получить список услуг текущего пользователя-репетитора',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findMy(@CurrentUser() user: User) {
    const services = await this.servicesService.findByTutor(user.id);
    return {
      items: services,
      total: services.length,
    };
  }

  @Get('by-tutor/:tutorId')
  @ApiOperation({
    summary: 'Получить услуги репетитора',
    description: 'Получить все услуги конкретного репетитора',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findByTutor(@Param('tutorId', ParseUUIDPipe) tutorId: string) {
    const services = await this.servicesService.findByTutor(tutorId);
    return {
      items: services,
      total: services.length,
    };
  }

  @Get('by-subject-teacher/:subjectId/:teacherId')
  @ApiOperation({
    summary: 'Получить услуги по предмету и преподавателю',
    description: 'Получить услуги для конкретной связки предмет-преподаватель',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findBySubjectAndTeacher(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ) {
    const services = await this.servicesService.getServicesBySubjectAndTeacher(
      subjectId,
      teacherId,
    );
    return {
      items: services,
      total: services.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить услугу по ID',
    description: 'Получить подробную информацию об услуге с откликами',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику услуги',
    description: 'Получить детальную статистику по услуге (отклики, сделки)',
  })
  @ApiSuccessResponse()
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.getServiceStats(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить услугу',
    description: 'Обновить информацию об услуге (только автор)',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем принадлежность услуги пользователю
    const service = await this.servicesService.findOne(id);
    if (service.tutorId !== user.id) {
      throw new Error('Можно редактировать только свои услуги');
    }
    return this.servicesService.update(id, updateServiceDto);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Активировать услугу',
    description: 'Сделать услугу доступной для откликов',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const service = await this.servicesService.findOne(id);
    if (service.tutorId !== user.id) {
      throw new Error('Можно управлять только своими услугами');
    }
    return this.servicesService.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Деактивировать услугу',
    description: 'Скрыть услугу от студентов',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const service = await this.servicesService.findOne(id);
    if (service.tutorId !== user.id) {
      throw new Error('Можно управлять только своими услугами');
    }
    return this.servicesService.deactivate(id);
  }

  @Patch(':id/suspend')
  @ApiOperation({
    summary: 'Приостановить услугу',
    description: 'Временно приостановить услугу (администратор)',
  })
  @ApiSuccessResponse(ServiceResponseDto)
  async suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.suspend(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить услугу',
    description: 'Полностью удалить услугу (только если нет активных откликов)',
  })
  @ApiSuccessResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const service = await this.servicesService.findOne(id);
    if (service.tutorId !== user.id) {
      throw new Error('Можно удалять только свои услуги');
    }
    await this.servicesService.remove(id);
    return {
      message: 'Услуга успешно удалена',
      deletedAt: new Date(),
    };
  }
}
