-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VocabularyEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "word" TEXT NOT NULL,
    "wordLower" TEXT NOT NULL,
    "phonetic" TEXT,
    "mnemonic" TEXT,
    "categoryId" INTEGER,
    "meanings" TEXT,
    "collocations" TEXT,
    "forgetCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VocabularyEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VocabularyCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_VocabularyEntry" ("categoryId", "collocations", "createdAt", "id", "meanings", "mnemonic", "phonetic", "updatedAt", "word", "wordLower") SELECT "categoryId", "collocations", "createdAt", "id", "meanings", "mnemonic", "phonetic", "updatedAt", "word", "wordLower" FROM "VocabularyEntry";
DROP TABLE "VocabularyEntry";
ALTER TABLE "new_VocabularyEntry" RENAME TO "VocabularyEntry";
CREATE UNIQUE INDEX "VocabularyEntry_wordLower_key" ON "VocabularyEntry"("wordLower");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
