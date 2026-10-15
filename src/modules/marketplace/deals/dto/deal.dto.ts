import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export type DealStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

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
