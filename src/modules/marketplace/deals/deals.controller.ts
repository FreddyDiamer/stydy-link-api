import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import {
  CreateDealDto,
  DealResponseDto,
  DealListQueryDto,
  DealFilterDto,
  CancelDealDto,
} from './dto/deal.dto';
import { PaginationDto, ApiSuccessResponse, CurrentUser } from '@common';
import { User } from '@prisma/client';

@ApiTags('Marketplace - Deals')
@Controller('marketplace/deals')
@ApiBearerAuth()
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать сделку' })
  @ApiSuccessResponse(DealResponseDto)
  create(@Body() dto: CreateDealDto, @CurrentUser() user: User) {
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Список моих сделок',
    description:
      'Сделки, где текущий пользователь — участник; role=tutor или role=student оставляет сделки, где он в этой роли',
  })
  @ApiSuccessResponse(DealResponseDto)
  findAll(@Query() query: DealListQueryDto, @CurrentUser() user: User) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const pagination: PaginationDto = {
      page,
      limit,
      skip: (page - 1) * limit,
    };
    const { page: _page, limit: _limit, ...filter } = query;
    void _page;
    void _limit;
    return this.service.findAll(pagination, filter as DealFilterDto, user.id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Принять сделку' })
  @ApiSuccessResponse(DealResponseDto)
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.accept(id, user.id);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Отклонить сделку' })
  @ApiSuccessResponse(DealResponseDto)
  reject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.reject(id, user.id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Завершить сделку' })
  @ApiSuccessResponse(DealResponseDto)
  complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.complete(id, user.id);
  }

  @Patch(':id/reopen')
  @ApiOperation({
    summary: 'Работа ещё не готова',
    description:
      'Снимает подтверждение второй стороны и останавливает авто-закрытие сделки',
  })
  @ApiSuccessResponse(DealResponseDto)
  reopen(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.reopen(id, user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Отменить сделку' })
  @ApiSuccessResponse(DealResponseDto)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: CancelDealDto,
  ) {
    return this.service.cancel(id, user.id, dto?.reason);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить сделку по id (только участник)' })
  @ApiSuccessResponse(DealResponseDto)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOneForUser(id, user.id);
  }
}
