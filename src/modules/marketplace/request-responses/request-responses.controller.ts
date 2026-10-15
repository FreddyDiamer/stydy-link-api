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
import { RequestResponsesService } from './request-responses.service';
import {
  CreateRequestResponseDto,
  UpdateRequestResponseDto,
  RequestResponseResponseDto,
  RequestResponseFilterDto,
} from './dto/request-response.dto';
import { ApiSuccessResponse, CurrentUser } from '@common';
import { User } from '@prisma/client';

@ApiTags('Marketplace - Request Responses')
@Controller('marketplace/request-responses')
@ApiBearerAuth()
export class RequestResponsesController {
  constructor(private readonly service: RequestResponsesService) {}

  @Post()
  @ApiOperation({ summary: 'Создать отклик на заявку' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  create(@Body() dto: CreateRequestResponseDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Get()
  @ApiOperation({
    summary: 'Список откликов',
    description:
      'Отклики, доступные текущему пользователю: свои и отклики на свои заявки. ' +
      'role=tutor — только свои, role=student — только на свои заявки; ' +
      'requestId, status и остальные фильтры сужают выдачу',
  })
  @ApiSuccessResponse(RequestResponseResponseDto)
  findAll(
    @Query() filter: RequestResponseFilterDto,
    @CurrentUser() user: User,
  ) {
    return this.service.findAll(filter, user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить отклик по id',
    description: 'Только автор отклика и автор заявки',
  })
  @ApiSuccessResponse(RequestResponseResponseDto)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOneForUser(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить отклик (только автор)' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestResponseDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(id, dto, user);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Принять отклик (студент)' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.accept(id, user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Отклонить отклик (студент)' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.reject(id, user);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Отменить принятый отклик (студент)' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.cancel(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить отклик' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }
}
