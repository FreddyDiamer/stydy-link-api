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

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить отклик' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
