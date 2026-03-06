/*
  Warnings:

  - You are about to drop the `ListenRecord` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ListenRecord";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "UserWordStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "UserWordStat_userId_word_key" ON "UserWordStat"("userId", "word");
