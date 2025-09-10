-- CreateEnum
CREATE TYPE "public"."ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."DealStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('TUTOR', 'STUDENT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "telegramUsername" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT,
    "avatarUrl" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teachers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "foreignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teacher_subjects" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_subjects" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT,
    "status" "public"."ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "description" TEXT,
    "budget" INTEGER,
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."deals" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" "public"."DealStatus" NOT NULL DEFAULT 'PENDING',
    "serviceResponseId" TEXT,
    "requestResponseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_responses" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "message" TEXT,
    "price" INTEGER,
    "proposedDeadline" TIMESTAMP(3),
    "status" "public"."ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."request_responses" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "message" TEXT,
    "price" INTEGER,
    "proposedDeadline" TIMESTAMP(3),
    "status" "public"."ResponseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reviews" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "targetRole" "public"."UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramUsername_key" ON "public"."users"("telegramUsername");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "public"."users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "public"."subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_teacherId_subjectId_key" ON "public"."teacher_subjects"("teacherId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "group_subjects_groupId_subjectId_key" ON "public"."group_subjects"("groupId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_serviceResponseId_key" ON "public"."deals"("serviceResponseId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_requestResponseId_key" ON "public"."deals"("requestResponseId");

-- CreateIndex
CREATE UNIQUE INDEX "service_responses_studentId_serviceId_key" ON "public"."service_responses"("studentId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_tutorId_requestId_key" ON "public"."request_responses"("tutorId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_dealId_key" ON "public"."reviews"("dealId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."teacher_subjects" ADD CONSTRAINT "teacher_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_subjects" ADD CONSTRAINT "group_subjects_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_subjects" ADD CONSTRAINT "group_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."requests" ADD CONSTRAINT "requests_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_serviceResponseId_fkey" FOREIGN KEY ("serviceResponseId") REFERENCES "public"."service_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."deals" ADD CONSTRAINT "deals_requestResponseId_fkey" FOREIGN KEY ("requestResponseId") REFERENCES "public"."request_responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_responses" ADD CONSTRAINT "service_responses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_responses" ADD CONSTRAINT "service_responses_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."request_responses" ADD CONSTRAINT "request_responses_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."request_responses" ADD CONSTRAINT "request_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "public"."deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reviews" ADD CONSTRAINT "reviews_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
