import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '@common';

export class CreateSubjectDto {
  @ApiProperty({
    description: 'Название предмета университета',
    example: 'Математика',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Активен ли предмет для выбора',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

/** Пагинация внутри фильтра: два @Query() на одном методе не проходят forbidNonWhitelisted */
export class SubjectFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Фильтр по статусу активности',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value as boolean | undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Поиск по названию предмета',
    example: 'Матем',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class SubjectResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Название предмета',
    example: 'Математика',
  })
  name: string;

  @ApiProperty({
    description: 'Статус активности предмета',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Преподаватели, ведущие данный предмет',
    isArray: true,
  })
  teacherSubjects?: any[];

  @ApiPropertyOptional({
    description: 'Статистика использования предмета',
  })
  _count?: {
    services: number;
    requests: number;
    deals: number;
  };
}

/** Элемент списка предметов: без вложенных преподавателей и счётчиков */
export class SubjectListItemDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 'Математика' })
  name: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}
