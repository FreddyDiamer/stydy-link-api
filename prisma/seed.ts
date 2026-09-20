import {
  DealStatus,
  PrismaClient,
  RequestStatus,
  ResponseStatus,
  ServiceStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

// Тестовые пользователи для локальной разработки.
// telegramId/telegramUsername уникальны — повторный запуск безопасен (upsert).
const users = [
  {
    telegramId: '852915881',
    telegramUsername: 'anna_math',
    name: 'Анна Смирнова',
    description: 'Репетитор по высшей математике, 5 лет опыта.',
    balance: 150000,
  },
  {
    telegramId: '731002455',
    telegramUsername: 'ivan_phys',
    name: 'Иван Петров',
    description: 'Преподаю физику и сопромат для студентов КАИ.',
    balance: 90000,
  },
  {
    telegramId: '610223344',
    telegramUsername: 'maria_eng',
    name: 'Мария Кузнецова',
    description:
      'Английский язык: подготовка к экзаменам и разговорная практика.',
    balance: 0,
  },
  {
    telegramId: '500112233',
    telegramUsername: 'dmitry_code',
    name: 'Дмитрий Соколов',
    description: 'Программирование: Python, C++, алгоритмы.',
    balance: 230000,
  },
  {
    telegramId: '498877665',
    telegramUsername: 'elena_chem',
    name: 'Елена Морозова',
    description: 'Химия и материаловедение.',
    balance: 12000,
  },
  {
    telegramId: '477665544',
    telegramUsername: 'student_oleg',
    name: 'Олег Васильев',
    description: 'Студент 2 курса, ищу помощь по матанализу.',
    balance: 50000,
  },
  {
    telegramId: '466554433',
    telegramUsername: 'student_kira',
    name: 'Кира Новикова',
    description: 'Нужен репетитор по английскому.',
    balance: 30000,
  },
  {
    telegramId: '455443322',
    telegramUsername: 'student_pavel',
    name: 'Павел Орлов',
    description: 'Готовлюсь к пересдаче по физике.',
    balance: 0,
  },
];

async function linkTeacherToSubjects(
  teacher: { id: string },
  subjectNames: string[],
  allSubjects: Array<{ id: string; name: string }>,
) {
  for (const subjectName of subjectNames) {
    const subject = allSubjects.find((s) => s.name === subjectName);
    if (subject) {
      await prisma.teacherSubject.upsert({
        where: {
          teacherId_subjectId: {
            teacherId: teacher.id,
            subjectId: subject.id,
          },
        },
        update: { isActive: true },
        create: {
          teacherId: teacher.id,
          subjectId: subject.id,
          isActive: true,
        },
      });
      console.log(`  ✓ ${teacher.id.substring(0, 8)}... ↔ ${subjectName}`);
    }
  }
}

// =============================================================================
// Демо-данные маркетплейса
// =============================================================================
// У Service и Request нет естественного уникального ключа, поэтому у них
// фиксированные id; отклики, сделки и отзывы находятся по @@unique из схемы.
// Везде update: {} — повторный запуск досоздаёт недостающее и не трогает
// строки, которые уже двигали руками.
// Сделки появляются только из принятых откликов, а цена и срок считаются так
// же, как в accept(): цена отклика, иначе цена услуги / бюджет заявки.

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);
const daysAgo = (days: number) => daysFromNow(-days);

interface DemoReview {
  by: 'student' | 'tutor';
  rating: number;
  comment?: string;
  reply?: string;
}

interface DemoDeal {
  status: DealStatus;
  createdDaysAgo: number;
  studentConfirmedDaysAgo?: number;
  tutorConfirmedDaysAgo?: number;
  cancelledBy?: 'student' | 'tutor';
  cancelledDaysAgo?: number;
  cancelReason?: string;
  reviews?: DemoReview[];
}

interface DemoResponse {
  from: string; // telegramUsername откликнувшегося
  status: ResponseStatus;
  respondedDaysAgo: number;
  message?: string;
  price?: number; // копейки
  deadlineInDays?: number; // отрицательное — срок уже прошёл
  proposedDeadlineType?: string;
  budgetType?: string;
  deal?: DemoDeal;
}

interface DemoService {
  id: string;
  tutor: string;
  subject: string;
  teacher: string; // foreignId
  price: number; // копейки
  description: string;
  status: ServiceStatus;
  lessonsCount?: number;
  lessonDurationMinutes?: number;
  createdDaysAgo: number;
  responses: DemoResponse[];
}

interface DemoRequest {
  id: string;
  student: string;
  subject: string;
  teacher: string; // foreignId
  description: string;
  budget?: number; // копейки
  deadlineInDays?: number;
  status: RequestStatus;
  closedDaysAgo?: number;
  createdDaysAgo: number;
  responses: DemoResponse[];
}

const demoServices: DemoService[] = [
  {
    id: '5eed0001-0000-4000-8000-000000000001',
    tutor: 'anna_math',
    subject: 'Математический анализ',
    teacher: 'teacher_001',
    price: 150000,
    description:
      'Подготовка к экзамену по матанализу: пределы, производные, интегралы. Разбираем билеты прошлых лет.',
    status: 'ACTIVE',
    lessonsCount: 4,
    lessonDurationMinutes: 90,
    createdDaysAgo: 45,
    responses: [
      {
        from: 'student_oleg',
        status: 'ACCEPTED',
        respondedDaysAgo: 2,
        message: 'Экзамен через две недели, хочу пройти весь курс.',
        deadlineInDays: 12,
        proposedDeadlineType: 'custom',
        budgetType: 'service-price',
        // только что принятая бронь: сделка ждёт подтверждения
        deal: { status: 'PENDING', createdDaysAgo: 1 },
      },
      {
        from: 'student_kira',
        status: 'PENDING',
        respondedDaysAgo: 1,
        message: 'Нужны только интегралы, можно дешевле?',
        price: 130000,
        deadlineInDays: 7,
        proposedDeadlineType: 'week',
        budgetType: 'lower',
      },
    ],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000002',
    tutor: 'anna_math',
    subject: 'Линейная алгебра',
    teacher: 'teacher_001',
    price: 120000,
    description: 'Матрицы, определители, системы уравнений — с нуля до зачёта.',
    status: 'ACTIVE',
    lessonsCount: 3,
    createdDaysAgo: 30,
    responses: [
      {
        from: 'student_pavel',
        status: 'PENDING',
        respondedDaysAgo: 0,
        message: 'Готов начать на следующей неделе.',
        deadlineInDays: 30,
        proposedDeadlineType: 'month',
        budgetType: 'service-price',
      },
    ],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000003',
    tutor: 'ivan_phys',
    subject: 'Физика',
    teacher: 'teacher_002',
    price: 130000,
    description: 'Механика и электродинамика, решение задач к контрольным.',
    status: 'ACTIVE',
    lessonsCount: 2,
    createdDaysAgo: 35,
    responses: [
      {
        from: 'student_oleg',
        status: 'ACCEPTED',
        respondedDaysAgo: 22,
        message: 'Нужно подтянуть механику к контрольной.',
        deadlineInDays: -16,
        proposedDeadlineType: 'week',
        budgetType: 'service-price',
        deal: {
          status: 'COMPLETED',
          createdDaysAgo: 21,
          tutorConfirmedDaysAgo: 15,
          studentConfirmedDaysAgo: 14,
          reviews: [
            {
              by: 'student',
              rating: 4,
              comment: 'Объясняет понятно, но один раз перенесли занятие.',
            },
            {
              by: 'tutor',
              rating: 5,
              comment: 'Пунктуальный и мотивированный студент.',
            },
          ],
        },
      },
    ],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000004',
    tutor: 'maria_eng',
    subject: 'Английский язык',
    teacher: 'teacher_008',
    price: 100000,
    description: 'Разговорная практика и подготовка к зачёту по английскому.',
    status: 'ACTIVE',
    lessonsCount: 8,
    createdDaysAgo: 30,
    responses: [
      {
        from: 'student_pavel',
        status: 'ACCEPTED',
        respondedDaysAgo: 9,
        message: 'Нужно сдать зачёт, уровень слабый.',
        price: 95000,
        deadlineInDays: 5,
        proposedDeadlineType: 'custom',
        budgetType: 'lower',
        deal: {
          status: 'CANCELLED',
          createdDaysAgo: 8,
          cancelledBy: 'student',
          cancelledDaysAgo: 5,
          cancelReason:
            'Зачёт перенесли на следующий семестр, занятия пока не нужны.',
        },
      },
    ],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000005',
    tutor: 'dmitry_code',
    subject: 'Программирование',
    teacher: 'teacher_004',
    price: 200000,
    description: 'Python и C++: лабораторные, курсовые, подготовка к экзамену.',
    status: 'ACTIVE',
    lessonsCount: 5,
    lessonDurationMinutes: 90,
    createdDaysAgo: 40,
    responses: [
      {
        from: 'student_oleg',
        status: 'ACCEPTED',
        respondedDaysAgo: 10,
        message: 'Помогите с курсовой на C++.',
        price: 180000,
        // Срок впереди: авто-подтверждение не закрывает сделку раньше её
        // дедлайна, поэтому состояние «подтвердила одна сторона» живёт долго
        deadlineInDays: 21,
        proposedDeadlineType: 'month',
        budgetType: 'lower',
        deal: {
          status: 'ACCEPTED',
          createdDaysAgo: 9,
          tutorConfirmedDaysAgo: 1,
        },
      },
      {
        from: 'student_kira',
        status: 'ACCEPTED',
        respondedDaysAgo: 28,
        message: 'Нужна помощь с лабораторными по Python.',
        deadlineInDays: -21,
        proposedDeadlineType: 'week',
        budgetType: 'service-price',
        deal: {
          status: 'COMPLETED',
          createdDaysAgo: 27,
          studentConfirmedDaysAgo: 20,
          tutorConfirmedDaysAgo: 19,
          // отзыв оставила только одна сторона
          reviews: [
            {
              by: 'student',
              rating: 4,
              comment: 'Все лабораторные сдала, спасибо!',
            },
          ],
        },
      },
    ],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000006',
    tutor: 'dmitry_code',
    subject: 'Алгоритмы и структуры данных',
    teacher: 'teacher_004',
    price: 250000,
    description:
      'Графы, динамическое программирование, подготовка к олимпиадам.',
    status: 'INACTIVE',
    createdDaysAgo: 60,
    responses: [],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000007',
    tutor: 'elena_chem',
    subject: 'Химия',
    teacher: 'teacher_003',
    price: 90000,
    description: 'Общая и органическая химия для первого курса.',
    status: 'SUSPENDED',
    createdDaysAgo: 50,
    responses: [],
  },
  {
    id: '5eed0001-0000-4000-8000-000000000008',
    tutor: 'ivan_phys',
    subject: 'Математика',
    teacher: 'teacher_002',
    price: 110000,
    description: 'Высшая математика для технических специальностей.',
    status: 'ACTIVE',
    createdDaysAgo: 20,
    responses: [
      {
        from: 'student_pavel',
        status: 'REJECTED',
        respondedDaysAgo: 12,
        message: 'Можно заниматься только по ночам?',
        price: 60000,
        proposedDeadlineType: 'today',
        budgetType: 'lower',
      },
    ],
  },
];

const demoRequests: DemoRequest[] = [
  {
    id: '5eed0002-0000-4000-8000-000000000001',
    student: 'student_oleg',
    subject: 'Математический анализ',
    teacher: 'teacher_001',
    description: 'Не понимаю ряды и несобственные интегралы, скоро коллоквиум.',
    budget: 200000,
    deadlineInDays: 10,
    status: 'OPEN',
    createdDaysAgo: 3,
    responses: [
      {
        from: 'anna_math',
        status: 'PENDING',
        respondedDaysAgo: 2,
        message: 'Веду этот курс пятый год, уложимся в три занятия.',
        price: 180000,
        deadlineInDays: 9,
      },
      {
        from: 'ivan_phys',
        status: 'PENDING',
        respondedDaysAgo: 1,
        message: 'Могу помочь, есть свободные вечера.',
        price: 160000,
      },
    ],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000002',
    student: 'student_kira',
    subject: 'Английский язык',
    teacher: 'teacher_008',
    description:
      'Нужен репетитор для подготовки к зачёту, уровень Intermediate.',
    budget: 120000,
    deadlineInDays: 14,
    status: 'MATCHED',
    createdDaysAgo: 6,
    responses: [
      {
        from: 'maria_eng',
        status: 'ACCEPTED',
        respondedDaysAgo: 5,
        message: 'Готовлю к этому зачёту каждый семестр.',
        price: 110000,
        deal: { status: 'ACCEPTED', createdDaysAgo: 4 },
      },
      {
        from: 'dmitry_code',
        status: 'REJECTED',
        respondedDaysAgo: 5,
        message: 'Могу помочь с техническим английским для IT.',
        price: 100000,
      },
    ],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000003',
    student: 'student_pavel',
    subject: 'Физика',
    teacher: 'teacher_002',
    description:
      'Пересдача по физике, нужно разобрать задачи по электростатике.',
    budget: 150000,
    deadlineInDays: -13,
    status: 'MATCHED',
    createdDaysAgo: 25,
    responses: [
      {
        from: 'ivan_phys',
        status: 'ACCEPTED',
        respondedDaysAgo: 24,
        message: 'Разберём все типовые задачи пересдачи.',
        price: 140000,
        deal: {
          status: 'COMPLETED',
          createdDaysAgo: 23,
          tutorConfirmedDaysAgo: 12,
          studentConfirmedDaysAgo: 11,
          reviews: [
            {
              by: 'student',
              rating: 5,
              comment: 'Пересдал на четвёрку, всё разобрали по полочкам.',
              reply: 'Рад, что получилось! Обращайся перед следующей сессией.',
            },
            {
              by: 'tutor',
              rating: 5,
              comment: 'Всегда приходил подготовленным.',
            },
          ],
        },
      },
    ],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000004',
    student: 'student_oleg',
    subject: 'Программирование',
    teacher: 'teacher_004',
    description: 'Ищу наставника по Python, без жёстких сроков.',
    status: 'OPEN',
    createdDaysAgo: 1,
    responses: [],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000005',
    student: 'student_kira',
    subject: 'Химия',
    teacher: 'teacher_003',
    description: 'Помощь с лабораторной по органике.',
    budget: 80000,
    deadlineInDays: -2,
    status: 'CLOSED',
    closedDaysAgo: 3,
    createdDaysAgo: 12,
    // закрытие заявки отклоняет все ожидающие отклики
    responses: [
      {
        from: 'elena_chem',
        status: 'REJECTED',
        respondedDaysAgo: 10,
        message: 'Помогу оформить и защитить лабораторную.',
        price: 75000,
      },
    ],
  },
  {
    id: '5eed0002-0000-4000-8000-000000000006',
    student: 'student_pavel',
    subject: 'Дискретная математика',
    teacher: 'teacher_007',
    description: 'Графы и комбинаторика, контрольная на следующей неделе.',
    budget: 100000,
    deadlineInDays: 7,
    status: 'OPEN',
    createdDaysAgo: 2,
    responses: [
      {
        from: 'anna_math',
        status: 'PENDING',
        respondedDaysAgo: 1,
        message: 'Дискретку тоже веду, успеем за два занятия.',
        price: 90000,
        deadlineInDays: 6,
      },
    ],
  },
];

interface SeedRefs {
  userIds: Map<string, string>;
  subjectIds: Map<string, string>;
  teacherIds: Map<string, string>;
}

function mustGet(map: Map<string, string>, key: string, kind: string): string {
  const id = map.get(key);
  if (!id) {
    throw new Error(`Seed: не найден ${kind} "${key}"`);
  }
  return id;
}

async function seedDeal(
  demo: DemoDeal,
  link: { serviceResponseId: string } | { requestResponseId: string },
  base: {
    studentId: string;
    tutorId: string;
    subjectId: string;
    teacherId: string;
    price: number;
    deadline?: Date;
  },
) {
  const deal = await prisma.deal.upsert({
    where: link,
    update: {},
    create: {
      ...base,
      ...link,
      status: demo.status,
      createdAt: daysAgo(demo.createdDaysAgo),
      studentConfirmedAt:
        demo.studentConfirmedDaysAgo !== undefined
          ? daysAgo(demo.studentConfirmedDaysAgo)
          : undefined,
      tutorConfirmedAt:
        demo.tutorConfirmedDaysAgo !== undefined
          ? daysAgo(demo.tutorConfirmedDaysAgo)
          : undefined,
      cancelledAt:
        demo.cancelledDaysAgo !== undefined
          ? daysAgo(demo.cancelledDaysAgo)
          : undefined,
      cancelledById: demo.cancelledBy
        ? demo.cancelledBy === 'student'
          ? base.studentId
          : base.tutorId
        : undefined,
      cancelReason: demo.cancelReason,
    },
  });

  for (const review of demo.reviews ?? []) {
    const byStudent = review.by === 'student';
    const authorId = byStudent ? base.studentId : base.tutorId;
    await prisma.review.upsert({
      where: { dealId_authorId: { dealId: deal.id, authorId } },
      update: {},
      create: {
        dealId: deal.id,
        authorId,
        targetId: byStudent ? base.tutorId : base.studentId,
        targetRole: byStudent ? 'TUTOR' : 'STUDENT',
        rating: review.rating,
        comment: review.comment,
        reply: review.reply,
      },
    });
  }
}

async function seedMarketplace(refs: SeedRefs) {
  console.log('🛒 Создаем услуги, отклики и сделки...');
  for (const demo of demoServices) {
    const tutorId = mustGet(refs.userIds, demo.tutor, 'пользователь');
    const subjectId = mustGet(refs.subjectIds, demo.subject, 'предмет');
    const teacherId = mustGet(refs.teacherIds, demo.teacher, 'преподаватель');

    const service = await prisma.service.upsert({
      where: { id: demo.id },
      update: {},
      create: {
        id: demo.id,
        tutorId,
        subjectId,
        teacherId,
        price: demo.price,
        description: demo.description,
        status: demo.status,
        lessonsCount: demo.lessonsCount,
        lessonDurationMinutes: demo.lessonDurationMinutes,
        createdAt: daysAgo(demo.createdDaysAgo),
      },
    });

    for (const r of demo.responses) {
      const studentId = mustGet(refs.userIds, r.from, 'пользователь');
      const proposedDeadline =
        r.deadlineInDays !== undefined
          ? daysFromNow(r.deadlineInDays)
          : undefined;
      const response = await prisma.serviceResponse.upsert({
        where: {
          studentId_serviceId: { studentId, serviceId: service.id },
        },
        update: {},
        create: {
          studentId,
          serviceId: service.id,
          message: r.message,
          price: r.price,
          proposedDeadline,
          proposedDeadlineType: r.proposedDeadlineType,
          budgetType: r.budgetType,
          status: r.status,
          createdAt: daysAgo(r.respondedDaysAgo),
        },
      });

      if (r.deal) {
        await seedDeal(
          r.deal,
          { serviceResponseId: response.id },
          {
            studentId,
            tutorId,
            subjectId,
            teacherId,
            price: r.price ?? demo.price,
            deadline: proposedDeadline,
          },
        );
      }
    }
    console.log(
      `  ✓ ${demo.subject} (@${demo.tutor}, ${demo.status}) — откликов: ${demo.responses.length}`,
    );
  }

  console.log('📝 Создаем заявки, отклики и сделки...');
  for (const demo of demoRequests) {
    const studentId = mustGet(refs.userIds, demo.student, 'пользователь');
    const subjectId = mustGet(refs.subjectIds, demo.subject, 'предмет');
    const teacherId = mustGet(refs.teacherIds, demo.teacher, 'преподаватель');
    const requestDeadline =
      demo.deadlineInDays !== undefined
        ? daysFromNow(demo.deadlineInDays)
        : undefined;

    const request = await prisma.request.upsert({
      where: { id: demo.id },
      update: {},
      create: {
        id: demo.id,
        studentId,
        subjectId,
        teacherId,
        description: demo.description,
        budget: demo.budget,
        deadline: requestDeadline,
        status: demo.status,
        closedAt:
          demo.closedDaysAgo !== undefined
            ? daysAgo(demo.closedDaysAgo)
            : undefined,
        createdAt: daysAgo(demo.createdDaysAgo),
      },
    });

    for (const r of demo.responses) {
      const tutorId = mustGet(refs.userIds, r.from, 'пользователь');
      const proposedDeadline =
        r.deadlineInDays !== undefined
          ? daysFromNow(r.deadlineInDays)
          : undefined;
      const response = await prisma.requestResponse.upsert({
        where: { tutorId_requestId: { tutorId, requestId: request.id } },
        update: {},
        create: {
          tutorId,
          requestId: request.id,
          message: r.message,
          price: r.price,
          proposedDeadline,
          status: r.status,
          createdAt: daysAgo(r.respondedDaysAgo),
        },
      });

      if (r.deal) {
        const price = r.price ?? demo.budget;
        if (price === undefined) {
          throw new Error(`Seed: у сделки по заявке ${demo.id} нет цены`);
        }
        await seedDeal(
          r.deal,
          { requestResponseId: response.id },
          {
            studentId,
            tutorId,
            subjectId,
            teacherId,
            price,
            deadline: proposedDeadline ?? requestDeadline,
          },
        );
      }
    }
    console.log(
      `  ✓ ${demo.subject} (@${demo.student}, ${demo.status}) — откликов: ${demo.responses.length}`,
    );
  }
}

async function main() {
  // Seed создаёт фейковых пользователей, сделки и отзывы — в production ему не место
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed запрещён в production (NODE_ENV=production)');
  }

  console.log('🌱 Начинаем заполнение базы данных...');

  console.log('👤 Создаем пользователей...');
  const userIds = new Map<string, string>();
  for (const user of users) {
    const result = await prisma.user.upsert({
      where: { telegramId: user.telegramId },
      update: {
        telegramUsername: user.telegramUsername,
        name: user.name,
        description: user.description,
        balance: user.balance,
      },
      create: user,
    });
    userIds.set(user.telegramUsername, result.id);
    console.log(
      `  ✓ ${result.name} (@${result.telegramUsername}) — ${result.id}`,
    );
  }

  const totalUsers = await prisma.user.count();
  console.log(`   Пользователей: ${totalUsers}`);

  const subjects = [
    'Математика',
    'Физика',
    'Химия',
    'Информатика',
    'Программирование',
    'Алгоритмы и структуры данных',
    'Базы данных',
    'Веб-разработка',
    'Машинное обучение',
    'Дискретная математика',
    'Линейная алгебра',
    'Математический анализ',
    'Теория вероятностей',
    'Статистика',
    'Английский язык',
    'Русский язык',
    'История',
    'Экономика',
  ];

  console.log('📚 Создаем предметы...');
  const createdSubjects: Array<{ id: string; name: string }> = [];
  for (const subjectName of subjects) {
    const subject = await prisma.subject.upsert({
      where: { name: subjectName },
      update: {},
      create: {
        name: subjectName,
        isActive: true,
      },
    });
    createdSubjects.push({ id: subject.id, name: subject.name });
    console.log(`  ✓ ${subjectName}`);
  }

  const teachers = [
    { fullName: 'Иванов Иван Иванович', foreignId: 'teacher_001' },
    { fullName: 'Петрова Мария Сергеевна', foreignId: 'teacher_002' },
    { fullName: 'Сидоров Петр Александрович', foreignId: 'teacher_003' },
    { fullName: 'Козлова Анна Владимировна', foreignId: 'teacher_004' },
    { fullName: 'Смирнов Дмитрий Николаевич', foreignId: 'teacher_005' },
    { fullName: 'Волкова Елена Олеговна', foreignId: 'teacher_006' },
    { fullName: 'Новиков Алексей Викторович', foreignId: 'teacher_007' },
    { fullName: 'Морозова Татьяна Игоревна', foreignId: 'teacher_008' },
    { fullName: 'Лебедев Сергей Михайлович', foreignId: 'teacher_009' },
    { fullName: 'Федорова Ольга Дмитриевна', foreignId: 'teacher_010' },
  ];

  console.log('👨‍🏫 Создаем преподавателей...');
  const createdTeachers: Array<{ id: string; foreignId: string }> = [];
  for (const teacherData of teachers) {
    const teacher = await prisma.teacher.upsert({
      where: { foreignId: teacherData.foreignId },
      update: {},
      create: {
        fullName: teacherData.fullName,
        foreignId: teacherData.foreignId,
      },
    });
    createdTeachers.push({ id: teacher.id, foreignId: teacher.foreignId });
    console.log(`  ✓ ${teacherData.fullName}`);
  }

  // В проде группы наполняет парсер университетского API; локально без них
  // выбор группы в профиле пуст. foreignId с префиксом seed_ не пересекается
  // с id из внешней системы, так что парсер эти строки не тронет.
  const groups = [
    { number: '4101', foreignId: 'seed_group_4101' },
    { number: '4131', foreignId: 'seed_group_4131' },
    { number: '4210', foreignId: 'seed_group_4210' },
    { number: '4241', foreignId: 'seed_group_4241' },
    { number: '4312', foreignId: 'seed_group_4312' },
    { number: '4333', foreignId: 'seed_group_4333' },
    { number: '4411', foreignId: 'seed_group_4411' },
    { number: '4432', foreignId: 'seed_group_4432' },
  ];

  console.log('🎓 Создаем группы...');
  for (const groupData of groups) {
    await prisma.group.upsert({
      where: { foreignId: groupData.foreignId },
      update: {},
      create: groupData,
    });
    console.log(`  ✓ ${groupData.number}`);
  }

  console.log('🔗 Связываем преподавателей с предметами...');

  await linkTeacherToSubjects(
    createdTeachers[0],
    ['Математика', 'Линейная алгебра', 'Математический анализ'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[1],
    ['Физика', 'Математика'],
    createdSubjects,
  );

  await linkTeacherToSubjects(createdTeachers[2], ['Химия'], createdSubjects);

  await linkTeacherToSubjects(
    createdTeachers[3],
    ['Информатика', 'Программирование', 'Алгоритмы и структуры данных'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[4],
    ['Базы данных', 'Веб-разработка'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[5],
    ['Машинное обучение', 'Статистика'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[6],
    ['Дискретная математика', 'Теория вероятностей'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[7],
    ['Английский язык'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[8],
    ['Русский язык', 'История'],
    createdSubjects,
  );

  await linkTeacherToSubjects(
    createdTeachers[9],
    ['Экономика', 'Статистика'],
    createdSubjects,
  );

  await seedMarketplace({
    userIds,
    subjectIds: new Map(createdSubjects.map((s) => [s.name, s.id])),
    teacherIds: new Map(createdTeachers.map((t) => [t.foreignId, t.id])),
  });

  console.log('✅ База данных успешно заполнена!');
  console.log(`   Предметов: ${createdSubjects.length}`);
  console.log(`   Преподавателей: ${createdTeachers.length}`);
  console.log(`   Групп: ${await prisma.group.count()}`);
  console.log(
    `   Услуг: ${await prisma.service.count()}, заявок: ${await prisma.request.count()}, ` +
      `сделок: ${await prisma.deal.count()}, отзывов: ${await prisma.review.count()}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
