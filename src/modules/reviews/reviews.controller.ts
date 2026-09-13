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
import { ReviewsService } from './reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  SetReviewReplyDto,
  ReviewResponseDto,
  ReviewFilterDto,
} from './dto/review.dto';
import {
  PaginationDto,
  ApiSuccessResponse,
  CurrentUser,
  ForbiddenException,
} from '@common';
import { User } from '@prisma/client';

@ApiTags('Reviews')
@Controller('reviews')
@ApiBearerAuth()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({
    summary: 'Создать отзыв',
    description: 'Оставить отзыв по завершенной сделке',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: User,
  ) {
    return this.reviewsService.create(createReviewDto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Получить список отзывов',
    description: 'Получить список отзывов с фильтрацией и пагинацией',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findAll(
    @Query() paginationDto: PaginationDto,
    @Query() filterDto: ReviewFilterDto,
  ) {
    return this.reviewsService.findAll(paginationDto, filterDto);
  }

  @Get('my')
  @ApiOperation({
    summary: 'Получить мои отзывы',
    description: 'Получить список отзывов, написанных текущим пользователем',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findMy(@CurrentUser() user: User) {
    const reviews = await this.reviewsService.findByAuthor(user.id);
    return {
      items: reviews,
      total: reviews.length,
    };
  }

  @Get('about-me')
  @ApiOperation({
    summary: 'Получить отзывы обо мне',
    description:
      'Получить список отзывов о текущем пользователе (опционально по роли: TUTOR | STUDENT)',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findAboutMe(
    @CurrentUser() user: User,
    @Query('targetRole') targetRole?: 'TUTOR' | 'STUDENT',
  ) {
    const reviews = await this.reviewsService.findByTarget(user.id, targetRole);
    return {
      items: reviews,
      total: reviews.length,
    };
  }

  @Get('stats/:targetId')
  @ApiOperation({
    summary: 'Получить статистику отзывов пользователя',
    description:
      'Получить детальную статистику отзывов и рейтингов (опционально по роли: TUTOR | STUDENT)',
  })
  @ApiSuccessResponse()
  async getTargetStats(
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Query('targetRole') targetRole?: 'TUTOR' | 'STUDENT',
  ) {
    return this.reviewsService.getTargetStats(targetId, targetRole);
  }

  @Get('top-rated/:role')
  @ApiOperation({
    summary: 'Получить топ пользователей по рейтингу',
    description: 'Получить список лучших репетиторов или студентов по рейтингу',
  })
  @ApiSuccessResponse()
  async getTopRated(
    @Param('role') role: 'TUTOR' | 'STUDENT',
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getTopRatedUsers(role, limit);
  }

  @Get('by-target/:targetId')
  @ApiOperation({
    summary: 'Получить отзывы о пользователе',
    description:
      'Получить отзывы о пользователе (опционально по роли: TUTOR | STUDENT)',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findByTarget(
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Query('targetRole') targetRole?: 'TUTOR' | 'STUDENT',
  ) {
    const reviews = await this.reviewsService.findByTarget(
      targetId,
      targetRole,
    );
    return {
      items: reviews,
      total: reviews.length,
    };
  }

  @Get('reputation/:targetId')
  @ApiOperation({
    summary: 'Репутация пользователя',
    description:
      'Средний рейтинг и число отзывов отдельно как об исполнителе и как о заказчике',
  })
  async getReputation(@Param('targetId', ParseUUIDPipe) targetId: string) {
    return this.reviewsService.getReputation(targetId);
  }

  @Get('deal/:dealId')
  @ApiOperation({
    summary: 'Получить отзывы по сделке',
    description: 'Получить все отзывы по конкретной сделке',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findByDeal(@Param('dealId', ParseUUIDPipe) dealId: string) {
    return this.reviewsService.findByDeal(dealId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Получить отзыв по ID',
    description: 'Получить подробную информацию об отзыве',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить отзыв',
    description: 'Обновить рейтинг или комментарий к отзыву (только автор)',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: User,
  ) {
    // Проверяем принадлежность отзыва пользователю
    const review = await this.reviewsService.findOne(id);
    if (review.authorId !== user.id) {
      throw new ForbiddenException('Можно редактировать только свои отзывы');
    }
    return this.reviewsService.update(id, updateReviewDto);
  }

  @Patch(':id/reply')
  @ApiOperation({
    summary: 'Ответить на отзыв / изменить / удалить ответ',
    description:
      'Репетитор может оставить ответ на отзыв, изменить или удалить его (reply: null)',
  })
  @ApiSuccessResponse(ReviewResponseDto)
  async setReply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReviewReplyDto,
    @CurrentUser() user: User,
  ) {
    return this.reviewsService.setReply(id, user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Удалить отзыв',
    description: 'Удалить отзыв (только автор или администратор)',
  })
  @ApiSuccessResponse()
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const review = await this.reviewsService.findOne(id);
    if (review.authorId !== user.id) {
      throw new ForbiddenException('Можно удалять только свои отзывы');
    }
    await this.reviewsService.remove(id);
    return {
      message: 'Отзыв успешно удален',
      deletedAt: new Date(),
    };
  }
}
