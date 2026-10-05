/*
  Warnings:

  - You are about to alter the column `correctMarks` on the `Quiz` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `wrongMarks` on the `Quiz` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `skippedMarks` on the `Quiz` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Quiz" ALTER COLUMN "correctMarks" SET DEFAULT 4,
ALTER COLUMN "correctMarks" SET DATA TYPE INTEGER,
ALTER COLUMN "wrongMarks" SET DEFAULT -1,
ALTER COLUMN "wrongMarks" SET DATA TYPE INTEGER,
ALTER COLUMN "skippedMarks" SET DEFAULT 0,
ALTER COLUMN "skippedMarks" SET DATA TYPE INTEGER;
