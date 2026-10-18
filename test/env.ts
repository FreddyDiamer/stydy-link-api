/**
 * Окружение e2e: отдельная база, чтобы тесты никогда не стреляли в рабочую.
 * DATABASE_URL_TEST задаётся снаружи (CI, docker-compose), иначе — локальный дефолт.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://postgres:postgres@127.0.0.1:5432/studylink_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ??
  'e2e-secret-key-that-is-definitely-longer-than-32-chars';
process.env.JWT_EXPIRES_IN = '1h';
// токена бота нет — уведомления в тестах никуда не уходят
delete process.env.TELEGRAM_BOT_TOKEN;
// секрет вебхука — чтобы проверить приём апдейтов; без токена бота вебхук не регистрируется
process.env.TELEGRAM_WEBHOOK_SECRET = 'e2e-webhook-secret-0123456789';
