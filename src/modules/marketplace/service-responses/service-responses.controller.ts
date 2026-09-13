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
import { ServiceResponsesService } from './service-responses.service';
import {
  CreateServiceResponseDto,
  UpdateServiceResponseDto,
  ServiceResponseResponseDto,
  ServiceResponseFilterDto,
} from './dto/service-response.dto';
import {
  PaginationDto,
  ApiSuccessResponse,
  CurrentUser,
  ForbiddenException,
} from '@common';
import { User } from '@prisma/client';

@ApiTags('Marketplace - Service Responses')
@Controller('marketplace/service-responses')
@ApiBearerAuth()
export class ServiceResponsesController {
  constructor(
    private readonly serviceResponsesService: ServiceResponsesService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Создать отклик на услугу',
    description: 'Студент откликается на услугу репетитора',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async create(
    @Body() createServiceResponseDto: CreateServiceResponseDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем, что пользователь создает отклик для себя
    if (createServiceResponseDto.studentId !== user.id) {
      throw new ForbiddenException(
        'Нельзя создавать отклики от имени других пользователей',
      );
    }
    return this.serviceResponsesService.create(createServiceResponseDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список откликов',
    description: 'Получить список откликов студентов на услуги с фильтрацией',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ServiceResponseFilterDto,
  ) {
    return this.serviceResponsesService.findAll(paginationDto, filterDto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Получить мои отклики',
    description: 'Получить список откликов текущего пользователя-студента',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findMy(@CurrentUser() user: User) {
    const responses = await this.serviceResponsesService.findByStudent(user.id);
    return {
      items: responses,
      total: responses.length,
    };
  }

  @Get('by-service/:serviceId')
  @ApiOperation({
    summary: 'Получить отклики на услугу',
    description: 'Получить все отклики на конкретную услугу (для репетитора)',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findByService(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    const responses =
      await this.serviceResponsesService.findByService(serviceId);
    return {
      items: responses,
      total: responses.length,
    };
  }

  @Get('by-service/:serviceId/pending')
  @ApiOperation({
    summary: 'Получить ожидающие отклики на услугу',
    description: 'Получить отклики на услугу со статусом PENDING',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findPendingByService(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    const responses =
      await this.serviceResponsesService.findPendingByService(serviceId);
    return {
      items: responses,
      total: responses.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить отклик по ID',
    description: 'Получить подробную информацию об отклике',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceResponsesService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику отклика',
    description: 'Получить статистику по отклику (сделки, статус)',
  })
  @ApiSuccessResponse()
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceResponsesService.getResponseStats(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить отклик',
    description: 'Обновить отклик на услугу (только автор)',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceResponseDto: UpdateServiceResponseDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем принадлежность отклика пользователю
    const response = await this.serviceResponsesService.findOne(id);
    if (response.studentId !== user.id) {
      throw new ForbiddenException('Можно редактировать только свои отклики');
    }
    return this.serviceResponsesService.update(id, updateServiceResponseDto);
  }

  @Patch(':id/accept')
  @ApiOperation({
    summary: 'Принять отклик',
    description: 'Репетитор принимает отклик студента (создается сделка)',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.serviceResponsesService.accept(id, user);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Отклонить отклик',
    description: 'Репетитор отклоняет отклик студента',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.serviceResponsesService.reject(id, user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить отклик',
    description: 'Удалить отклик на услугу (только автор, если нет сделки)',
  })
  @ApiSuccessResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const response = await this.serviceResponsesService.findOne(id);
    if (response.studentId !== user.id) {
      throw new ForbiddenException('Можно удалять только свои отклики');
    }
    await this.serviceResponsesService.remove(id);
    return {
      message: 'Отклик успешно удален',
      deletedAt: new Date(),
    };
  }
}
