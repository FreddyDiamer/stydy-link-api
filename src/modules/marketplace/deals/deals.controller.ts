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
import { DealsService } from './deals.service';
import {
  CreateDealDto,
  UpdateDealDto,
  DealResponseDto,
  DealFilterDto,
} from './dto/deal.dto';
import { PaginationDto, ApiSuccessResponse, CurrentUser } from '@common';

@ApiTags('Marketplace - Deals')
@Controller('marketplace/deals')
@ApiBearerAuth()
export class DealsController {
  constructor(private readonly service: DealsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать сделку' })
  @ApiSuccessResponse(DealResponseDto)
  create(@Body() dto: CreateDealDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список сделок' })
  @ApiSuccessResponse(DealResponseDto)
  findAll(@Query() pagination: PaginationDto, @Query() filter: DealFilterDto) {
    return this.service.findAll(pagination, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить сделку по id' })
  @ApiSuccessResponse(DealResponseDto)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить сделку' })
  @ApiSuccessResponse(DealResponseDto)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDealDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить сделку' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
