import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { TutorsService } from './tutors.service';
import { CurrentUser, ApiSuccessResponse } from '@common';

@ApiTags('Tutors')
@Controller('tutors')
@ApiBearerAuth()
export class TutorsController {
  constructor(private readonly tutorsService: TutorsService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Статистика репетитора',
    description: 'Получить статистику текущего пользователя как репетитора',
  })
  @ApiSuccessResponse()
  async getStats(@CurrentUser() user: User) {
    return this.tutorsService.getTutorStats(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить репетитора по ID',
    description: 'Профиль репетитора с услугами, рейтингом и отзывами',
  })
  @ApiSuccessResponse()
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.tutorsService.getTutorById(id);
  }
}
