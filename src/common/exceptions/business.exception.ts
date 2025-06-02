import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    code = 'BUSINESS_ERROR',
    statusCode = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        error: code,
        statusCode,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}

export class NotFoundException extends BusinessException {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with id '${identifier}' not found`
      : `${resource} not found`;

    super(message, 'NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', HttpStatus.FORBIDDEN);
  }
}
