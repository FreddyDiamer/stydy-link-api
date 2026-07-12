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
  @ApiOperation({ summary: 'Список откликов' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  findAll(@Query() filter: RequestResponseFilterDto) {
    return this.service.findAll(filter);
  }

  @Get('my')
  @ApiOperation({ summary: 'Мои отклики на заявки (репетитор)' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  findMy(@CurrentUser() user: User) {
    return this.service.findByTutor(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить отклик по id' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить отклик' })
  @ApiSuccessResponse(RequestResponseResponseDto)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestResponseDto,
  ) {
    return this.service.update(id, dto);
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
