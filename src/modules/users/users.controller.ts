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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UserFilterDto,
  UpdateGroupDto,
} from './dto/user.dto';
import { PaginationDto, CurrentUser, ApiSuccessResponse } from '@common';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать пользователя',
    description: 'Создание нового пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список пользователей',
    description: 'Получить список пользователей с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(UserResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: UserFilterDto,
  ) {
    return this.usersService.findAll(paginationDto, filterDto);
  }

  @Get('me')
  @ApiOperation({
    summary: 'Получить свой профиль',
    description: 'Получить подробную информацию о текущем пользователе',
  })
  @ApiSuccessResponse(UserResponseDto)
  async getMe(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  @Get('with-services')
  @ApiOperation({
    summary: 'Получить пользователей с услугами',
    description: 'Получить список пользователей которые предоставляют услуги',
  })
  @ApiSuccessResponse(UserResponseDto)
  async findUsersWithServices(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: UserFilterDto,
  ) {
    return this.usersService.findAll(paginationDto, filterDto);
  }

  @Get('with-requests')
  @ApiOperation({
    summary: 'Получить пользователей с заявками',
    description: 'Получить список пользователей которые создают заявки',
  })
  @ApiSuccessResponse(UserResponseDto)
  async findUsersWithRequests(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: UserFilterDto,
  ) {
    return this.usersService.findAll(paginationDto, filterDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить пользователя по ID',
    description: 'Получить подробную информацию о пользователе',
  })
  @ApiSuccessResponse(UserResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description: 'Получить статистику по услугам и заявкам пользователя',
  })
  @ApiSuccessResponse()
  async getStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getUserStats(id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Обновить свой профиль',
    description: 'Обновить информацию о себе',
  })
  @ApiSuccessResponse(UserResponseDto)
  async updateMe(
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    // Пользователи не могут менять статус верификации или активности
    const { isVerified, isActive, ...allowedUpdates } = updateUserDto;
    return this.usersService.update(user.id, allowedUpdates);
  }

  @Patch('group')
  @ApiOperation({
    summary: 'Обновить группу пользователя',
    description: 'Изменить группу пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async updateGroup(@CurrentUser() user: User, @Body() body: UpdateGroupDto) {
    return this.usersService.updateGroup(user.id, body.groupId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить пользователя',
    description: 'Обновить информацию о пользователе',
  })
  @ApiSuccessResponse(UserResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/verify')
  @ApiOperation({
    summary: 'Верифицировать пользователя',
    description: 'Установить статус верификации пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.verify(id);
  }

  @Patch(':id/unverify')
  @ApiOperation({
    summary: 'Снять верификацию пользователя',
    description: 'Убрать статус верификации пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async unverify(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unverify(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Деактивировать пользователя',
    description: 'Деактивировать аккаунт пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Активировать пользователя',
    description: 'Активировать аккаунт пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить пользователя',
    description: 'Полностью удалить пользователя из системы',
  })
  @ApiSuccessResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
