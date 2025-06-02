import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TelegramAuthDto {
  @ApiProperty({
    description: 'Telegram user ID',
    example: '123456789',
  })
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @ApiProperty({
    description: 'Telegram username',
    example: 'john_doe',
  })
  @IsString()
  @IsNotEmpty()
  telegramUsername: string;

  @ApiProperty({
    description: 'User full name',
    example: 'Иван Иванов',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    telegramUsername: string;
    name: string;
    isVerified: boolean;
  };
}
