import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JsonObject } from '@prisma/client/runtime/library';

export class CreateGroupDto {
  @ApiProperty({
    description: 'Внешний ID группы',
    example: 'external_group_123',
  })
  @IsString()
  @IsNotEmpty()
  foreignId: string;

  @ApiProperty({
    description: 'Номер группы',
    example: '4212',
  })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({
    description: 'Форма обучения',
    example: {
      educationForm: 'очная',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  data: JsonObject;
}

export class GroupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  foreignId: string;

  @ApiProperty()
  number: string;

  @ApiProperty()
  data: JsonObject;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class GroupSubjectTeacherDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 'Иванов Иван Иванович' })
  fullName: string;
}

export class GroupSubjectResponseDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @ApiProperty({ example: 'Математический анализ' })
  name: string;

  @ApiProperty({
    description: 'Преподаватели этого предмета именно в этой группе',
    type: [GroupSubjectTeacherDto],
  })
  teachers: GroupSubjectTeacherDto[];
}
