import {
  HttpStatus,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * Ошибка валидации запроса: message — понятный русский текст про первое поле
 * (фронт показывает его как есть), field — это поле, errors — все ошибки.
 */
export class RequestValidationException extends BusinessException {
  constructor(readonly errors: FieldError[]) {
    super(
      errors[0]?.message ?? 'Проверьте заполнение формы',
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Подписи полей из DTO; неизвестные поля показываются по имени */
const FIELD_LABELS: Record<string, string> = {
  authorId: 'Автор',
  avatarUrl: 'Фото профиля',
  budget: 'Бюджет',
  budgetType: 'Тип бюджета',
  comment: 'Комментарий',
  dealId: 'Сделка',
  deadline: 'Срок',
  description: 'Описание',
  foreignId: 'Внешний ID',
  fullName: 'ФИО',
  groupId: 'Группа',
  initData: 'Данные входа Telegram',
  isActive: 'Активность',
  lessonDurationMinutes: 'Длительность занятия',
  lessonsCount: 'Количество занятий',
  limit: 'Количество на странице',
  maxBudget: 'Максимальный бюджет',
  maxPrice: 'Максимальная цена',
  maxRating: 'Максимальная оценка',
  message: 'Сообщение',
  minBudget: 'Минимальный бюджет',
  minPrice: 'Минимальная цена',
  minRating: 'Минимальная оценка',
  name: 'Имя',
  notificationPreferences: 'Настройки уведомлений',
  number: 'Номер группы',
  page: 'Страница',
  price: 'Цена',
  proposedDeadline: 'Предложенный срок',
  proposedDeadlineType: 'Тип срока',
  rating: 'Оценка',
  reason: 'Причина',
  reply: 'Ответ',
  requestId: 'Заявка',
  role: 'Роль',
  search: 'Поиск',
  serviceId: 'Услуга',
  status: 'Статус',
  studentId: 'Студент',
  subjectId: 'Предмет',
  subjectName: 'Предмет',
  targetId: 'Получатель отзыва',
  targetRole: 'Роль получателя',
  teacherId: 'Преподаватель',
  teacherName: 'Преподаватель',
  telegramId: 'Telegram ID',
  telegramNotificationsEnabled: 'Уведомления в Telegram',
  telegramUsername: 'Имя пользователя Telegram',
  tutorId: 'Репетитор',
  userId: 'Пользователь',
  username: 'Имя пользователя Telegram',
};

const CYRILLIC = /[а-яё]/i;
const TRAILING_NUMBER = /(-?\d+(?:\.\d+)?)\D*$/;

const labelOf = (field: string): string => {
  const own = field.split('.').pop() ?? field;
  return FIELD_LABELS[own] ?? `Поле «${field}»`;
};

/** Текст ошибки по ключу ограничения; английское сообщение — источник чисел и значений */
const describe = (constraint: string, english: string): string => {
  const number = english.match(TRAILING_NUMBER)?.[1];
  switch (constraint) {
    case 'whitelistValidation':
      return 'такое поле не принимается';
    case 'isNotEmpty':
    case 'isDefined':
      return 'обязательное поле';
    case 'isString':
      return 'нужен текст';
    case 'isUuid':
      return 'некорректный идентификатор';
    case 'isNumber':
      return 'нужно число';
    case 'isInt':
      return 'нужно целое число';
    case 'isBoolean':
      return 'нужно true или false';
    case 'isDate':
    case 'isDateString':
    case 'isIso8601':
      return 'нужна дата — ГГГГ-ММ-ДД или полная дата ISO-8601';
    case 'min':
      return number ? `не меньше ${number}` : 'слишком маленькое значение';
    case 'max':
      return number ? `не больше ${number}` : 'слишком большое значение';
    case 'minLength':
      return number ? `не короче ${number} символов` : 'слишком короткий текст';
    case 'maxLength':
      return number ? `не длиннее ${number} символов` : 'слишком длинный текст';
    case 'isEnum':
    case 'isIn': {
      const values = english.split(': ').pop();
      return values
        ? `допустимые значения: ${values}`
        : 'недопустимое значение';
    }
    case 'isObject':
      return 'нужен объект';
    case 'isArray':
      return 'нужен список';
    default:
      return 'некорректное значение';
  }
};

const collect = (
  errors: ValidationError[],
  parent = '',
  out: FieldError[] = [],
): FieldError[] => {
  for (const error of errors) {
    const field = parent ? `${parent}.${error.property}` : error.property;
    for (const [constraint, english] of Object.entries(
      error.constraints ?? {},
    )) {
      // Свой русский текст из декоратора (@Min(100, { message: '…' })) — как есть
      const message = CYRILLIC.test(english)
        ? english
        : `${labelOf(field)}: ${describe(constraint, english)}`;
      out.push({ field, message });
    }
    if (error.children?.length) {
      collect(error.children, field, out);
    }
  }
  return out;
};

export const toFieldErrors = (errors: ValidationError[]): FieldError[] =>
  collect(errors);

/** Тот же конвейер в main.ts и в e2e: transform + whitelist + русские ошибки */
export const createValidationPipe = (): ValidationPipe =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    exceptionFactory: (errors) =>
      new RequestValidationException(toFieldErrors(errors)),
  });
