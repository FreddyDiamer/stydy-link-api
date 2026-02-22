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
import { RequestsService } from './requests.service';
import {
  CreateRequestDto,
  UpdateRequestDto,
  RequestResponseDto,
  RequestFilterDto,
} from './dto/request.dto';
import { ApiSuccessResponse, CurrentUser } from '@common';
import { User } from '@prisma/client';

@ApiTags('Marketplace - Requests')
@Controller('marketplace/requests')
@ApiBearerAuth()
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать заявку',
    description: 'Создание новой заявки студента на поиск репетитора',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем, что пользователь создает заявку для себя
    if (createRequestDto.studentId !== user.id) {
      throw new Error('Нельзя создавать заявки от имени других пользователей');
    }
    return this.requestsService.create(createRequestDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список заявок',
    description: 'Получить список заявок студентов с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findAll(
    @Query() filterDto: RequestFilterDto,
    @CurrentUser() user?: User,
  ) {
    return this.requestsService.findAll(filterDto, user?.id);
  }

  @Get('open')
  @ApiOperation({
    summary: 'Получить открытые заявки',
    description: 'Получить список открытых заявок для репетиторов',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findOpen(@CurrentUser() user?: User) {
    const requests = await this.requestsService.findOpenRequests(user?.id);
    return {
      items: requests,
      total: requests.length,
    };
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Получить популярные заявки',
    description:
      'Получить список самых популярных заявок по количеству откликов',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findPopular(@Query('limit') limit?: number) {
    const requests = await this.requestsService.getPopularRequests(limit);
    return {
      items: requests,
      total: requests.length,
    };
  }

  @Get('my')
  @ApiOperation({
    summary: 'Получить мои заявки',
    description: 'Получить список заявок текущего пользователя-студента',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findMy(@CurrentUser() user: User) {
    const requests = await this.requestsService.findByStudent(user.id);
    return {
      items: requests,
      total: requests.length,
    };
  }

  @Get('by-student/:studentId')
  @ApiOperation({
    summary: 'Получить заявки студента',
    description: 'Получить все заявки конкретного студента',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findByStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    const requests = await this.requestsService.findByStudent(studentId);
    return {
      items: requests,
      total: requests.length,
    };
  }

  @Get('by-subject-teacher/:subjectId/:teacherId')
  @ApiOperation({
    summary: 'Получить заявки по предмету и преподавателю',
    description: 'Получить заявки для конкретной связки предмет-преподаватель',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findBySubjectAndTeacher(
    @Param('subjectId', ParseUUIDPipe) subjectId: string,
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
  ) {
    const requests = await this.requestsService.getRequestsBySubjectAndTeacher(
      subjectId,
      teacherId,
    );
    return {
      items: requests,
      total: requests.length,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить заявку по ID',
    description: 'Получить подробную информацию о заявке с откликами',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить заявку',
    description: 'Обновить информацию о заявке (только автор)',
  })
  @ApiSuccessResponse(RequestResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRequestDto: UpdateRequestDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем принадлежность заявки пользователю
    const request = await this.requestsService.findOne(id);
    if (request.studentId !== user.id) {
      throw new Error('Можно редактировать только свои заявки');
    }
    return this.requestsService.update(id, updateRequestDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить заявку',
    description: 'Полностью удалить заявку (только если нет активных откликов)',
  })
  @ApiSuccessResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const request = await this.requestsService.findOne(id);
    if (request.studentId !== user.id) {
      throw new Error('Можно удалять только свои заявки');
    }
    await this.requestsService.remove(id);
    return {
      message: 'Заявка успешно удалена',
      deletedAt: new Date(),
    };
  }
}
