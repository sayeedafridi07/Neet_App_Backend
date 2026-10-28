-- Add subjectId to Chapter first
ALTER TABLE "Chapter" ADD COLUMN "subjectId" TEXT;

-- Update existing chapter with subject from its class (in case data exists)
UPDATE "Chapter" c
SET "subjectId" = ac."subjectId"
FROM "AcademicClass" ac
WHERE c."classId" = ac."id";

-- Make subjectId required
ALTER TABLE "Chapter" ALTER COLUMN "subjectId" SET NOT NULL;

-- DropForeignKey from AcademicClass
ALTER TABLE "AcademicClass" DROP CONSTRAINT "AcademicClass_subjectId_fkey";

-- DropIndex
DROP INDEX "AcademicClass_subjectId_idx";

-- DropIndex
DROP INDEX "AcademicClass_subjectId_slug_key";

-- AlterTable
ALTER TABLE "AcademicClass" DROP COLUMN "subjectId";

-- CreateIndex
CREATE UNIQUE INDEX "AcademicClass_slug_key" ON "AcademicClass"("slug");

-- DropIndex
DROP INDEX "Chapter_classId_slug_key";

-- CreateIndex
CREATE INDEX "Chapter_subjectId_idx" ON "Chapter"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_classId_subjectId_slug_key" ON "Chapter"("classId", "subjectId", "slug");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
