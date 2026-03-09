import { pathnames } from "@/modules/ui/pathnames";
import { Vocabulary } from "@/modules/vocabulary/ui";
import Link from "next/link";

export default function VocabularyPage() {
  return (
    <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">词汇</h1>
        <Link
          href={pathnames.vocabularyImport()}
          className="btn btn-outline btn-sm"
        >
          批量录入
        </Link>
      </div>
      <Vocabulary />
    </div>
  );
}
