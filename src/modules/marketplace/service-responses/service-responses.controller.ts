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
import { ApiSuccessResponse, CurrentUser, ForbiddenException } from '@common';
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
    description:
      'Отклики, доступные текущему пользователю: свои и отклики на свои услуги. ' +
      'role=student — только свои, role=tutor — только на свои услуги; ' +
      'serviceId, status и остальные фильтры сужают выдачу',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findAll(
    @Query() query: ServiceResponseFilterDto,
    @CurrentUser() user: User,
  ) {
    return this.serviceResponsesService.findAll(query, query, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить отклик по ID',
    description:
      'Подробная информация об отклике (только автор и владелец услуги)',
  })
  @ApiSuccessResponse(ServiceResponseResponseDto)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.serviceResponsesService.findOneForUser(id, user.id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику отклика',
    description:
      'Статистика по отклику: сделки, статус (только автор и владелец услуги)',
  })
  @ApiSuccessResponse()
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    await this.serviceResponsesService.findOneForUser(id, user.id);
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
