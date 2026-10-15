import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type DealStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export class CreateDealDto {
  @ApiProperty({ description: 'ID студента', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'ID репетитора', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  tutorId: string;

  @ApiProperty({ description: 'ID предмета', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;

  @ApiProperty({ description: 'ID преподавателя', example: '...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional({ description: 'Цена', example: 10000 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(10000000)
  price: number;

  @ApiPropertyOptional({
    description: 'Дедлайн',
    example: '2024-06-01T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  deadline: string;

  @ApiPropertyOptional({ description: 'ID отклика на услугу' })
  @IsOptional()
  @IsUUID()
  serviceResponseId?: string;

  @ApiPropertyOptional({ description: 'ID отклика на заявку' })
  @IsOptional()
  @IsUUID()
  requestResponseId?: string;
}

export class CancelDealDto {
  @ApiPropertyOptional({
    description: 'Причина отмены, видна обеим сторонам',
    example: 'Не совпало расписание',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DealFilterDto {
  @ApiPropertyOptional({
    description:
      'Моя роль в сделке: tutor — я репетитор, student — я студент. Без параметра — все мои сделки',
    enum: ['student', 'tutor'],
  })
  @IsOptional()
  @IsEnum(['student', 'tutor'])
  role?: 'student' | 'tutor';

  @ApiPropertyOptional({ description: 'ID студента' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'ID репетитора' })
  @IsOptional()
  @IsUUID()
  tutorId?: string;

  @ApiPropertyOptional({ description: 'ID предмета' })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'ID преподавателя' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Статус сделки',
    enum: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: DealStatus;

  @ApiPropertyOptional({ description: 'Минимальная цена' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Максимальная цена' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}

/** Query DTO для GET /deals: пагинация + фильтр в одном объекте (избегаем forbidNonWhitelisted при двух @Query()) */
export class DealListQueryDto extends DealFilterDto {
  @ApiPropertyOptional({
    description: 'Номер страницы',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== ''
      ? parseInt(
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : '1',
          10,
        )
      : 1,
  )
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Размер страницы',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== ''
      ? parseInt(
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : '10',
          10,
        )
      : 10,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class DealResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() studentId: string;
  @ApiProperty() tutorId: string;
  @ApiProperty() subjectId: string;
  @ApiProperty() teacherId: string;
  @ApiPropertyOptional() price?: number;
  @ApiPropertyOptional() deadline?: string;
  @ApiProperty() status: DealStatus;
  @ApiPropertyOptional() serviceResponseId?: string;
  @ApiPropertyOptional() requestResponseId?: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;
}
