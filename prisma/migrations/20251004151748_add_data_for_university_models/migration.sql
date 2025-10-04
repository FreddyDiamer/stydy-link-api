/*
  Warnings:

  - You are about to drop the column `isActive` on the `subjects` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[foreignId]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[foreignId]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `foreignId` to the `groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foreignId` to the `subjects` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "data" JSONB,
ADD COLUMN     "foreignId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "isActive",
ADD COLUMN     "data" JSONB,
ADD COLUMN     "foreignId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "data" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "groups_foreignId_key" ON "groups"("foreignId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_foreignId_key" ON "teachers"("foreignId");
