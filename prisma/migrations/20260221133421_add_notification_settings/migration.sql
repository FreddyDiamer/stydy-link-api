-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notificationPreferences" JSONB,
ADD COLUMN     "telegramNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
