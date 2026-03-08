-- CreateTable
CREATE TABLE "VocabularyAiFillTask" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VocabularyAiSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "accessToken" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "VocabularyAiFillTask_status_idx" ON "VocabularyAiFillTask"("status");
