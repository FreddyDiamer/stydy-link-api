/*
  Warnings:

  - You are about to drop the column `deadline` on the `services` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "services" DROP COLUMN "deadline",
ADD COLUMN     "lessonDurationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "lessonsCount" INTEGER NOT NULL DEFAULT 1;
