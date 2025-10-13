import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO для данных преподавателя из парсинга
 */
export class TeacherDto {
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
export class GroupDto {
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

export class ScheduleLessonDto {
  @ApiProperty({ description: 'Название дисциплины', example: 'Математика' })
  @IsString()
  disciplName: string;

  @ApiProperty({ description: 'Логин преподавателя', example: 'IvanovII' })
  @IsString()
  prepodLogin: string;
}
