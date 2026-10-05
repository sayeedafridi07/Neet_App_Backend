/*
  Warnings:

  - Added the required column `questionsSnapshot` to the `QuizAttempt` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'ASSERTION_REASON', 'MATCH_THE_FOLLOWING');

-- DropForeignKey
ALTER TABLE "QuizAttemptAnswer" DROP CONSTRAINT "QuizAttemptAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAttemptAnswer" DROP CONSTRAINT "QuizAttemptAnswer_selectedOptionId_fkey";

-- DropIndex
DROP INDEX "QuizAttemptAnswer_selectedOptionId_idx";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "content" JSONB,
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE';

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "questionsSnapshot" JSONB NOT NULL;

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");
