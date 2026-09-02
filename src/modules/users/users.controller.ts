import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { UsersService } from './users.service';
import {
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

  @Get()
  @ApiOperation({
    summary: 'Получить список пользователей',
    description:
      'Получить список публичных профилей с фильтрацией и пагинацией',
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
    description: 'Получить публичный профиль пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findPublicById(id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Получить статистику пользователя',
    description:
      'Получить статистику по услугам и заявкам пользователя (баланс — только для своего профиля)',
  })
  @ApiSuccessResponse()
  async getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.usersService.getUserStats(id, id === user.id);
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
    return this.usersService.update(user.id, updateUserDto);
  }

  @Patch('group')
  @ApiOperation({
    summary: 'Обновить группу пользователя',
    description: 'Изменить группу текущего пользователя',
  })
  @ApiSuccessResponse(UserResponseDto)
  async updateGroup(@CurrentUser() user: User, @Body() body: UpdateGroupDto) {
    return this.usersService.updateGroup(user.id, body.groupId);
  }
}
