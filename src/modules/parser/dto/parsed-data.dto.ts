import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO для данных преподавателя из парсинга
 */
export class ParsedTeacherDto {
  @ApiProperty({
    description: 'Полное имя преподавателя',
    example: 'Иванов Иван Иванович',
  })
  @IsString()
  @IsNotEmpty()
  lecturer: string;

  @ApiProperty({
    description: 'Login преподавателя',
    example: 'IvanovII',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}

/**
 * DTO для данных группы из парсинга
 */
export class ParsedGroupDto {
  @ApiProperty({
    description: 'Номер группы',
    example: '4312',
  })
  @IsString()
  @IsNotEmpty()
  group: string;

  @ApiProperty({
    description: 'Внешний идентификатор группы',
    example: 'GROUP_4312',
  })
  @IsNumber()
  @IsNotEmpty()
  id: number;

  @ApiProperty({
    description: 'Форма обучения',
    example: 'Очная',
  })
  @IsString()
  @IsNotEmpty()
  forma: string;
}

/**
 * DTO для данных предмета из парсинга
 */
export class ParsedSubjectDto {
  @ApiProperty({
    description: 'Название предмета',
    example: 'Математика',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Список внешних ID преподавателей',
    example: ['TEACHER_001', 'TEACHER_002'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  teacherIds: string[];

  @ApiProperty({
    description: 'Список внешних ID групп',
    example: ['GROUP_4312', 'GROUP_4313'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  groupIds: string[];
}
