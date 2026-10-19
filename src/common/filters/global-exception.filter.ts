import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';
import {
  RequestValidationException,
  type FieldError,
} from '../pipes/validation.pipe';
import type { RequestWithId } from '../middleware/request-id.middleware';

/** Ответ HttpException: строка или объект с message (строкой или массивом) */
type HttpErrorBody = string | { message?: string | string[]; error?: string };

/**
 * Ошибки Prisma, которые означают ошибку клиента, а не сервера: гонка двух
 * одинаковых запросов упирается в уникальный ключ, запись исчезла между
 * проверкой и изменением. Без этого такие запросы отвечали 500.
 */
const PRISMA_CLIENT_ERRORS: Record<
  string,
  { status: HttpStatus; error: string; message: string }
> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    error: 'CONFLICT',
    message: 'Такая запись уже существует',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    error: 'NOT_FOUND',
    message: 'Запись не найдена',
  },
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<
      Request & RequestWithId & { user?: { id?: string } }
    >();

    let status: number;
    let message: string | string[];
    let error: string;

    const prismaError =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? PRISMA_CLIENT_ERRORS[exception.code]
        : undefined;

    if (exception instanceof BusinessException) {
      // Наши кастомные бизнес-ошибки
      status = exception.getStatus();
      const errorResponse = exception.getResponse() as {
        message: string;
        error: string;
      };
      message = errorResponse.message;
      error = errorResponse.error;
    } else if (exception instanceof HttpException) {
      // Стандартные HTTP ошибки
      status = exception.getStatus();
      const errorResponse = exception.getResponse() as HttpErrorBody;
      message =
        typeof errorResponse === 'string'
          ? errorResponse
          : (errorResponse.message ?? exception.message);
      error = exception.constructor.name;
    } else if (prismaError) {
      status = prismaError.status;
      message = prismaError.message;
      error = prismaError.error;
    } else {
      // Неожиданные ошибки — это баг сервера, а не клиента: 500 и лог со стеком.
      // Сюда же попадает PrismaClientValidationError: значит, валидация DTO
      // пропустила то, что не должна была
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Внутренняя ошибка сервера. Попробуйте позже';
      error = 'InternalServerError';

      this.logger.error(
        `Unexpected error: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
        {
          requestId: request.requestId,
          url: request.url,
          method: request.method,
          user: request.user?.id,
        },
      );
    }

    const fieldErrors: { field?: string; errors?: FieldError[] } =
      exception instanceof RequestValidationException
        ? { field: exception.errors[0]?.field, errors: exception.errors }
        : {};

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.requestId,
      error,
      message,
      ...fieldErrors,
    };

    response.status(status).json(errorResponse);
  }
}
