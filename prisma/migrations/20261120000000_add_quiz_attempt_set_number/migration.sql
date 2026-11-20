-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN "setNumber" INTEGER;

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_quizId_setNumber_idx" ON "QuizAttempt"("userId", "quizId", "setNumber");
