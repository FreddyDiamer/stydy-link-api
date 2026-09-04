-- DropIndex
DROP INDEX "reviews_dealId_key";

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "studentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "tutorConfirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_dealId_authorId_key" ON "reviews"("dealId", "authorId");

