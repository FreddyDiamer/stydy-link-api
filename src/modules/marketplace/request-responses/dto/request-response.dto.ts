import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsClientDate, PaginationDto } from '@common';

export type ResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export class CreateRequestResponseDto {
  @ApiProperty({ description: 'ID репетитора', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  tutorId: string;

  @ApiProperty({ description: 'ID заявки', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  requestId: string;

  @ApiPropertyOptional({
    description: 'Сообщение при отклике',
    example: 'Готов помочь!',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Предложенная цена', example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000000)
  price?: number;

  @ApiPropertyOptional({
    description:
      'Предложенный дедлайн. ГГГГ-ММ-ДД принимается как конец этого дня по Москве; не раньше сегодняшнего дня',
    example: '2026-11-01T20:59:59.999Z',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsClientDate()
  proposedDeadline?: Date;
}

/**
 * Автор отклика может править только содержимое; статус меняется
 * исключительно через accept/reject/cancel, привязка (tutorId/requestId)
 * не изменяется.
 */
export class UpdateRequestResponseDto {
  @ApiPropertyOptional({
    description: 'Сообщение при отклике',
    example: 'Готов помочь!',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Предложенная цена', example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000000)
  price?: number;

  @ApiPropertyOptional({
    description:
      'Предложенный дедлайн. ГГГГ-ММ-ДД принимается как конец этого дня по Москве; не раньше сегодняшнего дня',
    example: '2026-11-01T20:59:59.999Z',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsClientDate()
  proposedDeadline?: Date;
}

export class RequestResponseFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description:
      'Чьи отклики: tutor — мои отклики на чужие заявки, student — отклики на мои заявки. Без параметра — и те и другие',
    enum: ['student', 'tutor'],
  })
  @IsOptional()
  @IsEnum(['student', 'tutor'])
  role?: 'student' | 'tutor';

  @ApiPropertyOptional({ description: 'ID репетитора' })
  @IsOptional()
  @IsUUID()
  tutorId?: string;

  @ApiPropertyOptional({ description: 'ID заявки' })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Статус отклика',
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
  status?: ResponseStatus;

  @ApiPropertyOptional({ description: 'Минимальная цена' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Максимальная цена' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Поиск по сообщению' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class RequestResponseResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() tutorId: string;
  @ApiProperty() requestId: string;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() price?: number;
  @ApiPropertyOptional() proposedDeadline?: string;
  @ApiProperty() status: ResponseStatus;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
