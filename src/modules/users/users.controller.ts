import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserFilterDto,
  UserResponseDto,
} from './dto/user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiSuccessResponse,
  ApiCreatedResponse,
  ApiPaginatedResponse,
} from '../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать пользователя',
    description: 'Создание нового пользователя',
  })
  @ApiCreatedResponse(UserResponseDto)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список пользователей',
    description: 'Получить список пользователей с фильтрацией и пагинацией',
  })
  @ApiPaginatedResponse(UserResponseDto)
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
  @ApiPaginatedResponse(UserResponseDto)
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
  @ApiPaginatedResponse(UserResponseDto)
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
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse(UserResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description: 'Получить статистику по услугам и заявкам пользователя',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить пользователя',
    description: 'Обновить информацию о пользователе',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
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
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse(UserResponseDto)
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.verify(id);
  }

  @Patch(':id/unverify')
  @ApiOperation({
    summary: 'Снять верификацию пользователя',
    description: 'Убрать статус верификации пользователя',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse(UserResponseDto)
  async unverify(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unverify(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Деактивировать пользователя',
    description: 'Деактивировать аккаунт пользователя',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse(UserResponseDto)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.deactivate(id);
  }

  @Patch(':id/activate')
  @ApiOperation({
    summary: 'Активировать пользователя',
    description: 'Активировать аккаунт пользователя',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse(UserResponseDto)
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.activate(id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить пользователя',
    description: 'Полностью удалить пользователя из системы',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiSuccessResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}
