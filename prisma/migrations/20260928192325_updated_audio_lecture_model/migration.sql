/*
  Warnings:

  - You are about to drop the column `sortOrder` on the `AudioLecture` table. All the data in the column will be lost.
  - You are about to drop the column `sortOrder` on the `KeywordRevision` table. All the data in the column will be lost.
  - Added the required column `order` to the `AudioLecture` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `KeywordRevision` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AudioLecture" DROP COLUMN "sortOrder",
ADD COLUMN     "order" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "KeywordRevision" DROP COLUMN "sortOrder",
ADD COLUMN     "order" INTEGER NOT NULL;
