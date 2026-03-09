import { VocabularyImport } from "@/modules/vocabulary/ui";

export default function VocabularyImportPage() {
  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
      <h1 className="text-2xl font-bold mb-6 sm:text-3xl">批量录入</h1>
      <VocabularyImport />
    </div>
  );
}
