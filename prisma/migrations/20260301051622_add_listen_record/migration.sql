-- CreateTable
CREATE TABLE "ListenRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongIndices" JSONB NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
