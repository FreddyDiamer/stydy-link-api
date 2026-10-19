import { ArgumentMetadata } from '@nestjs/common';
import { CreateRequestDto } from '../../modules/marketplace/requests/dto/request.dto';
import { CreateRequestResponseDto } from '../../modules/marketplace/request-responses/dto/request-response.dto';
import {
  createValidationPipe,
  RequestValidationException,
} from './validation.pipe';

const pipe = createValidationPipe();
const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const request = (extra: Record<string, unknown>) => ({
  studentId: UUID,
  subjectId: UUID,
  teacherId: UUID,
  ...extra,
});

const validationError = async (
  value: unknown,
  metatype: ArgumentMetadata['metatype'],
) => {
  try {
    await pipe.transform(value, body(metatype));
  } catch (error) {
    expect(error).toBeInstanceOf(RequestValidationException);
    return error as RequestValidationException;
  }
  throw new Error('Expected validation to fail');
};

describe('ValidationPipe с русскими ошибками', () => {
  it('дата без времени доходит до сервиса как Date (конец дня по Москве)', async () => {
    const dto = (await pipe.transform(
      request({ deadline: '2026-10-14' }),
      body(CreateRequestDto),
    )) as CreateRequestDto;

    expect(dto.deadline).toBeInstanceOf(Date);
    expect(dto.deadline?.toISOString()).toBe('2026-10-14T20:59:59.999Z');
  });

  it('неразборчивая дата — 400 с русским текстом про поле, а не строка в Prisma', async () => {
    const error = await validationError(
      request({ deadline: 'завтра' }),
      CreateRequestDto,
    );

    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe(
      'Срок: нужна дата — ГГГГ-ММ-ДД или полная дата ISO-8601',
    );
    expect(error.errors[0].field).toBe('deadline');
  });

  it('лишнее поле и ограничения без своего текста — по-русски', async () => {
    const error = await validationError(
      { tutorId: UUID, requestId: UUID, price: 50, authorId: 'x' },
      CreateRequestResponseDto,
    );

    expect(error.errors.map((e) => e.message)).toEqual(
      expect.arrayContaining([
        'Цена: не меньше 100',
        'Автор: такое поле не принимается',
      ]),
    );
  });

  it('свой русский текст из декоратора сохраняется', async () => {
    const error = await validationError(
      request({ budget: 50 }),
      CreateRequestDto,
    );

    expect(error.message).toBe('Минимальный бюджет 1 рубль (100 копеек)');
    expect(error.errors[0].field).toBe('budget');
  });

  it('неизвестное поле показывается по имени', async () => {
    const error = await validationError(
      request({ somethingNew: 1 }),
      CreateRequestDto,
    );

    expect(error.message).toBe(
      'Поле «somethingNew»: такое поле не принимается',
    );
  });
});
