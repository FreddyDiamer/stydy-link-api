import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...');

  // Создаем предметы
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

  // Создаем преподавателей
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

  // Связываем преподавателей с предметами
  console.log('🔗 Связываем преподавателей с предметами...');

  // Иванов Иван Иванович - Математика, Линейная алгебра, Математический анализ
  await linkTeacherToSubjects(
    createdTeachers[0],
    ['Математика', 'Линейная алгебра', 'Математический анализ'],
    createdSubjects,
  );

  // Петрова Мария Сергеевна - Физика, Математика
  await linkTeacherToSubjects(
    createdTeachers[1],
    ['Физика', 'Математика'],
    createdSubjects,
  );

  // Сидоров Петр Александрович - Химия
  await linkTeacherToSubjects(createdTeachers[2], ['Химия'], createdSubjects);

  // Козлова Анна Владимировна - Информатика, Программирование, Алгоритмы и структуры данных
  await linkTeacherToSubjects(
    createdTeachers[3],
    ['Информатика', 'Программирование', 'Алгоритмы и структуры данных'],
    createdSubjects,
  );

  // Смирнов Дмитрий Николаевич - Базы данных, Веб-разработка
  await linkTeacherToSubjects(
    createdTeachers[4],
    ['Базы данных', 'Веб-разработка'],
    createdSubjects,
  );

  // Волкова Елена Олеговна - Машинное обучение, Статистика
  await linkTeacherToSubjects(
    createdTeachers[5],
    ['Машинное обучение', 'Статистика'],
    createdSubjects,
  );

  // Новиков Алексей Викторович - Дискретная математика, Теория вероятностей
  await linkTeacherToSubjects(
    createdTeachers[6],
    ['Дискретная математика', 'Теория вероятностей'],
    createdSubjects,
  );

  // Морозова Татьяна Игоревна - Английский язык
  await linkTeacherToSubjects(
    createdTeachers[7],
    ['Английский язык'],
    createdSubjects,
  );

  // Лебедев Сергей Михайлович - Русский язык, История
  await linkTeacherToSubjects(
    createdTeachers[8],
    ['Русский язык', 'История'],
    createdSubjects,
  );

  // Федорова Ольга Дмитриевна - Экономика, Статистика
  await linkTeacherToSubjects(
    createdTeachers[9],
    ['Экономика', 'Статистика'],
    createdSubjects,
  );

  console.log('✅ База данных успешно заполнена!');
  console.log(`   Предметов: ${createdSubjects.length}`);
  console.log(`   Преподавателей: ${createdTeachers.length}`);
}

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

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
