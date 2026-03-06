-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ListenRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "chapterId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "wrongIndices" JSONB NOT NULL,
    "rate" REAL NOT NULL DEFAULT 1,
    "shuffle" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ListenRecord" ("accuracy", "chapterId", "completedAt", "correctCount", "id", "testId", "totalCount", "userId", "wrongIndices") SELECT "accuracy", "chapterId", "completedAt", "correctCount", "id", "testId", "totalCount", "userId", "wrongIndices" FROM "ListenRecord";
DROP TABLE "ListenRecord";
ALTER TABLE "new_ListenRecord" RENAME TO "ListenRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
