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
    description: 'Английский язык: подготовка к экзаменам и разговорная практика.',
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

async function main() {
  console.log('Seeding users...');

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
    console.log(`  ✓ ${result.name} (@${result.telegramUsername}) — ${result.id}`);
  }

  const total = await prisma.user.count();
  console.log(`Done. Total users in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
