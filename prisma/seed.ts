import { PrismaClient } from '@prisma/client';

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

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...');

  console.log('👤 Создаем пользователей...');
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
  const createdTeachers: Array<{ id: string }> = [];
  for (const teacherData of teachers) {
    const teacher = await prisma.teacher.upsert({
      where: { foreignId: teacherData.foreignId },
      update: {},
      create: {
        fullName: teacherData.fullName,
        foreignId: teacherData.foreignId,
      },
    });
    createdTeachers.push({ id: teacher.id });
    console.log(`  ✓ ${teacherData.fullName}`);
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

  console.log('✅ База данных успешно заполнена!');
  console.log(`   Предметов: ${createdSubjects.length}`);
  console.log(`   Преподавателей: ${createdTeachers.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
