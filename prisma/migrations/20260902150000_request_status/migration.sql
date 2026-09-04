-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "status" "RequestStatus" NOT NULL DEFAULT 'OPEN';

