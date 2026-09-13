import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '@common';

export class CreateTeacherSubjectDto {
  @ApiProperty({
    description: 'ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiProperty({
    description: 'ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;

  @ApiPropertyOptional({
    description: 'Активна ли связь преподавателя с предметом',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeacherSubjectDto extends PartialType(
  CreateTeacherSubjectDto,
) {}

/** Пагинация внутри фильтра: два @Query() на одном методе не проходят forbidNonWhitelisted */
export class TeacherSubjectFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Фильтр по ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'Фильтр по ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  subjectId?: string;

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
    description: 'Поиск по имени преподавателя',
    example: 'Иванов',
  })
  @IsOptional()
  @IsString()
  teacherName?: string;

  @ApiPropertyOptional({
    description: 'Поиск по названию предмета',
    example: 'Математика',
  })
  @IsOptional()
  @IsString()
  subjectName?: string;
}

export class TeacherSubjectResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор связи',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  id: string;

  @ApiProperty({
    description: 'ID преподавателя',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  teacherId: string;

  @ApiProperty({
    description: 'ID предмета',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  subjectId: string;

  @ApiProperty({
    description: 'Статус активности связи',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Дата создания связи',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2024-01-15T10:30:00Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Информация о преподавателе',
  })
  teacher?: {
    id: string;
    fullName: string;
  };

  @ApiPropertyOptional({
    description: 'Информация о предмете',
  })
  subject?: {
    id: string;
    name: string;
    isActive: boolean;
  };
}
