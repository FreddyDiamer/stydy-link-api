/*
  Warnings:

  - You are about to drop the column `data` on the `subjects` table. All the data in the column will be lost.
  - You are about to drop the column `foreignId` on the `subjects` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "subjects_name_key";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "data",
DROP COLUMN "foreignId",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
