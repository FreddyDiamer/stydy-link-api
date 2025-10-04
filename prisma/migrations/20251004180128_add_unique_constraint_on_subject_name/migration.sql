/*
  Warnings:

  - A unique constraint covering the columns `[foreignId]` on the table `groups` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[foreignId]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "data" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "groups_foreignId_key" ON "groups"("foreignId");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_foreignId_key" ON "teachers"("foreignId");
