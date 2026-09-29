-- CreateTable
CREATE TABLE "KeywordRevision" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "audioKey" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "chapterId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KeywordRevision_chapterId_idx" ON "KeywordRevision"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordRevision_chapterId_slug_key" ON "KeywordRevision"("chapterId", "slug");

-- AddForeignKey
ALTER TABLE "KeywordRevision" ADD CONSTRAINT "KeywordRevision_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
