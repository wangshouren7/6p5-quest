import { VocabularyImport } from "@/modules/vocabulary/ui";

export default function VocabularyImportPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">批量录入</h1>
      <VocabularyImport />
    </div>
  );
}
