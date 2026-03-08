/*
  Warnings:

  - You are about to drop the `UserWordStat` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserWordStat";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "CorpusChapter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER DEFAULT 0
);

-- CreateTable
CREATE TABLE "CorpusTest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chapterId" INTEGER NOT NULL,
    "testIndex" INTEGER NOT NULL,
    CONSTRAINT "CorpusTest_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "CorpusChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CorpusWord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "testId" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "meaning" TEXT NOT NULL,
    "audioPath" TEXT NOT NULL,
    CONSTRAINT "CorpusWord_testId_fkey" FOREIGN KEY ("testId") REFERENCES "CorpusTest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCorpusWordStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "historyInputs" TEXT,
    CONSTRAINT "UserCorpusWordStat_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "CorpusWord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VocabularyCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VocabularyMorpheme" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "meanings" TEXT
);

-- CreateTable
CREATE TABLE "VocabularyEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "wordLower" TEXT NOT NULL,
    "phonetic" TEXT,
    "categoryId" INTEGER,
    "meanings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VocabularyEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VocabularyCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VocabularyEntryMorpheme" (
    "entryId" INTEGER NOT NULL,
    "morphemeId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,

    PRIMARY KEY ("entryId", "morphemeId"),
    CONSTRAINT "VocabularyEntryMorpheme_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "VocabularyEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VocabularyEntryMorpheme_morphemeId_fkey" FOREIGN KEY ("morphemeId") REFERENCES "VocabularyMorpheme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VocabularyEntryPartOfSpeech" (
    "entryId" INTEGER NOT NULL,
    "partOfSpeech" TEXT NOT NULL,

    PRIMARY KEY ("entryId", "partOfSpeech"),
    CONSTRAINT "VocabularyEntryPartOfSpeech_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "VocabularyEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CorpusTest_chapterId_testIndex_key" ON "CorpusTest"("chapterId", "testIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CorpusWord_testId_index_key" ON "CorpusWord"("testId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "UserCorpusWordStat_userId_wordId_key" ON "UserCorpusWordStat"("userId", "wordId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyCategory_name_key" ON "VocabularyCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyMorpheme_type_text_key" ON "VocabularyMorpheme"("type", "text");

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyEntry_wordLower_key" ON "VocabularyEntry"("wordLower");
