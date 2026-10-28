-- DropIndex
DROP INDEX "Question_type_idx";

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "content",
DROP COLUMN "type";

-- DropEnum
DROP TYPE "QuestionType";
