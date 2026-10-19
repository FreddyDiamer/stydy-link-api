# Conventions

Project-specific code rules. Follow the surrounding code where this doc is silent.

## Errors

Throw `BusinessException` or its subclasses from `@common` (`src/common/exceptions/business.exception.ts`) — never raw `Error` and never bare Nest `HttpException` for business logic:

```typescript
import { NotFoundException, ForbiddenException } from '@common';

throw new NotFoundException('Service', serviceId); // → 404, code NOT_FOUND
throw new ForbiddenException('Только автор услуги может принимать отклики');
```

Available: `BusinessException` (400), `NotFoundException` (404), `ValidationException` (422), `UnauthorizedException` (401), `ForbiddenException` (403). `GlobalExceptionFilter` turns them into the standard error shape.

**Never wrap unexpected errors into a 400.** A `catch` may log context, but it rethrows what it caught: `BusinessException`/`NotFoundException` keep their status, anything else reaches the filter and becomes a 500 with a `requestId`. Turning a failed Prisma call into `BusinessException('Не удалось …')` hides a server bug behind a client error and loses the cause:

```typescript
} catch (error) {
  if (error instanceof BusinessException || error instanceof NotFoundException) {
    throw error;
  }
  this.logError('Ошибка создания заявки', error as Error, dto);
  throw error; // not: throw new BusinessException('Не удалось создать заявку')
}
```

## Services

- Services extend `BaseService` (`src/common/services/base.service.ts`) to get `this.logger`, `logInfo/logError/logWarn/logSuccess`, `retry()` and `sleep()`
- All Prisma access goes through the injected `DatabaseService` (`this.db.*`)
- Controllers stay thin: routing, ownership checks, Swagger decorators; logic lives in services

## DTOs and validation

- DTOs are classes with `class-validator` decorators plus `@ApiProperty`/`@ApiPropertyOptional` for Swagger; they live in each module's `dto/` folder
- The global `ValidationPipe` runs with `whitelist` + `forbidNonWhitelisted` — every accepted field must be declared in the DTO
- List endpoints take `PaginationDto` from `@common` (`page`, `limit` ≤ 100, computed `skip`) and return `PaginatedResult<T>`
- A list endpoint takes **one** `@Query()` object: the filter DTO extends `PaginationDto` (see `UserFilterDto`, `DealListQueryDto`). Two `@Query()` DTOs on one method fail `forbidNonWhitelisted` — each is validated against the whole query string
- UUID path params are validated with `ParseUUIDPipe`
- Dates from the client use `@IsClientDate()` from `@common` and are typed `Date` — never bare `@IsDateString()`, which lets `"2026-10-14"` through as a string that Prisma then rejects. `@IsClientDate()` accepts `YYYY-MM-DD` (end of that day, Moscow time) and full ISO-8601
- Deadlines may not lie before the start of today in Moscow: call `assertDeadlineNotPast` on create and `assertChangedDeadlineNotPast` on update (checks only a changed value) from `@common`
- Validation messages are Russian: a new DTO field gets a label in `FIELD_LABELS` (`src/common/pipes/validation.pipe.ts`), otherwise users see `Поле «fieldName»`

## Money

All money values are **integers in kopecks**: `User.balance`, `Service.price`, `Request.budget`, `Deal.price`, response `price`. Never use floats, never store rubles.

## Language

- Code identifiers and docs: English
- User-facing strings (bot notifications, business-error messages) and Swagger summaries: **Russian**
- Inline comments in existing code are often Russian — either language is fine for new comments

## Ownership checks

Mutating endpoints verify the current user owns the resource (or is a deal participant) before acting — see `accept()` in `src/modules/marketplace/service-responses/service-responses.service.ts` for the pattern. Get the caller via `@CurrentUser()`.

## Notifications

After a state change that the other party should hear about, fire the matching `NotificationService` method **fire-and-forget** with `void` — never `await` it in the request path:

```typescript
void this.notificationService.notifyServiceResponseAccepted({ ... });
```

## Formatting and linting

- ESLint 9 (flat config) + Prettier; Husky pre-commit runs lint-staged (eslint --fix + prettier on staged files)
- Do not run project-wide reformatting — only the lines you touch (see `docs/workflow/hard-rules.md`)
- Check manually with `pnpm run lint:check`
